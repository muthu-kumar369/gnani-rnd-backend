// src/modules/session/session.coordinator.ts
import { v4 as uuidv4 } from 'uuid';
import { createContextualLogger } from '../../core/logger/logger.js';
import { AudioProcessor } from './audio.processor.js';
import { TranscriptProcessor } from './transcript.processor.js';
import { ContextBuilder } from './context.builder.js';
import { LLMExecutor } from './llm.executor.js';
import { ToolExecutor } from './tool.executor.js';
import sessionMemory from '../memory/services/session-memory.service.js';
import metrics from '../../core/monitoring/metrics.js';
import auditService from '../../core/logger/audit.service.js';
import { Logger } from 'winston';
import Conversation from '../conversation/conversation.model.js';
import ConversationMessage from '../memory/entities/conversation.entity.js';

export interface Session {
    userId: string;
    createdAt: number;
    lastActivity: number;
    timeoutId: NodeJS.Timeout | null;
    onTranscriptionCallback: (transcript: string, isFinal: boolean) => Promise<void> | void;
    onLlmChunkCallback?: (text: string) => Promise<void> | void;
    onToolStatusCallback?: (status: any) => Promise<void> | void;
    metadata: any;
}

export class SessionCoordinator {
    private logger: Logger;
    private sessions: Map<string, Session> = new Map();
    private SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

    constructor(
        private audioProcessor: AudioProcessor,
        private transcriptProcessor: TranscriptProcessor,
        private contextBuilder: ContextBuilder,
        private llmExecutor: LLMExecutor,
        private toolExecutor: ToolExecutor
    ) {
        this.logger = createContextualLogger({ module: 'SessionCoordinator' });
        this.logger.info('SessionCoordinator initialized');
    }

    async startSession(
        userId: string,
        onTranscriptionCallback: (transcript: string, isFinal: boolean) => Promise<void> | void,
        onLlmChunkCallback?: (text: string) => Promise<void> | void,
        onToolStatusCallback?: (status: any) => Promise<void> | void,
        existingSessionId?: string
    ): Promise<string> {
        const sessionId = existingSessionId || uuidv4();

        if (existingSessionId) {
            this.logger.info(`Resuming existing session ID: ${sessionId}`);
        } else {
            this.logger.debug(`Generated new session ID: ${sessionId}`);
        }

        const session: Session = {
            userId,
            createdAt: Date.now(),
            lastActivity: Date.now(),
            timeoutId: null,
            onTranscriptionCallback,
            onLlmChunkCallback,
            onToolStatusCallback,
            metadata: {}
        };

        this.sessions.set(sessionId, session);

        // Initialize audio processor for this session
        await this.audioProcessor.initialize(sessionId);

        // Persist initial state to Redis
        try {
            await sessionMemory.setSessionState(sessionId, {
                userId,
                lastActivity: Date.now(),
                isSpeaking: false
            });
        } catch (error: any) {
            this.logger.error(`Failed to persist session state to Redis: ${error.message}`);
        }

        this.resetSessionTimeout(sessionId);
        this.logger.info(`Session started: ${sessionId} for user ${userId}`);
        metrics.activeSessionsGauge.inc();
        auditService.logEvent('SESSION_START', userId, sessionId, {}, 'success');

        return sessionId;
    }

    getSession(sessionId: string): Session | undefined {
        const session = this.sessions.get(sessionId);
        if (session) {
            this.resetSessionTimeout(sessionId);
        }
        return session;
    }

    async processAudioChunk(sessionId: string, audioChunk: Buffer, sampleRate: number): Promise<void> {
        this.logger.info(`[AUDIO-FLOW-3] SessionCoordinator processing audio chunk`, {
            sessionId,
            chunkSize: audioChunk.length,
            sampleRate
        });

        const session = this.sessions.get(sessionId);
        if (!session) {
            this.logger.error(`[AUDIO-FLOW-ERROR] Session ${sessionId} not found in coordinator`);
            throw new Error(`Session ${sessionId} not found`);
        }

        session.lastActivity = Date.now();
        this.resetSessionTimeout(sessionId);

        // Update Redis state (fire and forget)
        sessionMemory.updateSessionState(sessionId, {
            lastActivity: Date.now(),
            isSpeaking: true
        }).catch(err => this.logger.error(`Failed to update Redis session state: ${err.message}`));

        this.logger.info(`[AUDIO-FLOW-4] Delegating to audio processor for session ${sessionId}`);

        // Delegate to audio processor
        await this.audioProcessor.appendChunk(sessionId, audioChunk, sampleRate,
            (transcript: string, isFinal: boolean) => {
                this.logger.info(`[AUDIO-FLOW-5] Transcript callback triggered`, {
                    sessionId,
                    transcript: transcript.substring(0, 100),
                    isFinal,
                    transcriptLength: transcript.length
                });
                this.processTranscript(sessionId, transcript, isFinal);
            }
        );

        this.logger.info(`[AUDIO-FLOW-6] Audio processor appendChunk completed for session ${sessionId}`);
    }

    async finishAudioStream(sessionId: string): Promise<void> {
        this.logger.info(`[AUDIO-FLOW-FINISH] Finishing audio stream for session ${sessionId}`);
        const session = this.sessions.get(sessionId);
        if (!session) {
            this.logger.warn(`Session ${sessionId} not found when finishing audio stream`);
            return;
        }

        await this.audioProcessor.finishStream(sessionId, (transcript: string, isFinal: boolean) => {
            this.logger.info(`[AUDIO-FLOW-FINISH-CALLBACK] Transcript received`, {
                sessionId,
                transcript: transcript.substring(0, 100),
                isFinal
            });
            this.processTranscript(sessionId, transcript, isFinal);
        });
    }

    async processTranscript(sessionId: string, transcript: string, isFinal: boolean): Promise<void> {
        this.logger.info(`[AUDIO-FLOW-7] Processing transcript`, {
            sessionId,
            transcript: transcript.substring(0, 100),
            isFinal,
            transcriptLength: transcript.length
        });

        const session = this.sessions.get(sessionId);
        if (!session) {
            this.logger.error(`[AUDIO-FLOW-ERROR] Session ${sessionId} not found in processTranscript`);
            return;
        }

        // Notify frontend
        this.logger.info(`[AUDIO-FLOW-8] Calling onTranscriptionCallback for session ${sessionId}`);
        try {
            await session.onTranscriptionCallback(transcript, isFinal);
            this.logger.info(`[AUDIO-FLOW-9] onTranscriptionCallback completed for session ${sessionId}`);
        } catch (error: any) {
            this.logger.error(`[AUDIO-FLOW-ERROR] onTranscriptionCallback failed`, {
                sessionId,
                error: error.message
            });
        }

        if (isFinal && transcript && transcript !== 'ACK') {
            this.logger.info(`[AUDIO-FLOW-10] Final transcript detected, calling handleFinalTranscript`, {
                sessionId,
                transcript: transcript.substring(0, 50)
            });
            // Process complete transcript
            await this.handleFinalTranscript(sessionId, transcript);
        } else {
            this.logger.info(`[AUDIO-FLOW-SKIP] Skipping LLM processing`, {
                sessionId,
                reason: !isFinal ? 'not final' : transcript === 'ACK' ? 'ACK message' : 'empty transcript'
            });
        }
    }

    private async handleFinalTranscript(sessionId: string, transcript: string): Promise<{ llmResponse: string } | void> {
        this.logger.info(`[AUDIO-FLOW-11] handleFinalTranscript started`, {
            sessionId,
            transcript: transcript.substring(0, 100)
        });

        const session = this.sessions.get(sessionId);
        if (!session) {
            this.logger.error(`[AUDIO-FLOW-ERROR] Session ${sessionId} not found in handleFinalTranscript`);
            return;
        }

        try {
            this.logger.info(`[AUDIO-FLOW-12] Processing final transcript for session ${sessionId}: "${transcript.substring(0, 50)}..."`);

            // Step 1: Fetch conversation to get custom system prompt
            const conversation = await Conversation.findOne({ sessionId }).lean();
            const customSystemPrompt = conversation?.systemPrompt;

            // Save User Message to MongoDB
            try {
                await ConversationMessage.create({
                    userId: session.userId,
                    sessionId: sessionId,
                    role: 'user',
                    content: transcript,
                    timestamp: new Date()
                });
            } catch (dbError: any) {
                this.logger.error(`Failed to save user message: ${dbError.message}`);
            }

            // Step 2: Build context (memory + RAG)
            this.logger.info(`[AUDIO-FLOW-13] Building context for session ${sessionId}...`);
            const contextStartTime = Date.now();
            const context = await this.contextBuilder.build(
                sessionId,
                session.userId,
                transcript,
                undefined, // attachments
                customSystemPrompt
            );
            const contextDuration = Date.now() - contextStartTime;
            this.logger.info(`[AUDIO-FLOW-14] Context built for session ${sessionId}`, {
                duration: contextDuration,
                hasContext: !!context,
                customPrompt: !!customSystemPrompt
            });

            // Emit typing status: thinking
            if (session.metadata?.grpcCall) {
                session.metadata.grpcCall.write({
                    typing_status: {
                        status: 'thinking',
                        message: 'Building context...'
                    }
                });
            }

            // Step 2: Generate LLM response with Re-Act loop
            this.logger.info(`[AUDIO-FLOW-15] Calling LLMExecutor.generate for session ${sessionId}...`);

            // Emit typing status: generating
            if (session.metadata?.grpcCall) {
                session.metadata.grpcCall.write({
                    typing_status: {
                        status: 'generating',
                        message: undefined
                    }
                });
            }

            const llmStartTime = Date.now();
            const response = await this.llmExecutor.generate(
                context,
                session.onLlmChunkCallback
            );
            const llmDuration = Date.now() - llmStartTime;
            this.logger.info(`[AUDIO-FLOW-16] LLMExecutor returned for session ${sessionId}`, {
                duration: llmDuration,
                responseLength: response?.text?.length || 0,
                hasToolCalls: !!(response?.toolCalls?.length)
            });

            // Save Assistant Message to MongoDB
            try {
                await ConversationMessage.create({
                    userId: session.userId,
                    sessionId: sessionId,
                    role: 'assistant',
                    content: response.text,
                    timestamp: new Date(),
                    tokenUsage: response.tokenUsage ? {
                        inputTokens: response.tokenUsage.promptTokens,
                        outputTokens: response.tokenUsage.completionTokens,
                        totalTokens: response.tokenUsage.totalTokens,
                        estimatedCost: 0, // TODO: Calculate cost if needed
                        model: 'ollama' // Default or fetch from config
                    } : undefined
                });
            } catch (dbError: any) {
                this.logger.error(`Failed to save assistant message: ${dbError.message}`);
            }

            // Step 3: Execute tools if needed
            if (response.toolCalls && response.toolCalls.length > 0) {
                this.logger.info(`[AUDIO-FLOW-17] Executing ${response.toolCalls.length} tool(s) for session ${sessionId}`);
                await this.toolExecutor.executeTools(
                    sessionId,
                    response.toolCalls,
                    session.onToolStatusCallback
                );
                this.logger.info(`[AUDIO-FLOW-18] Tool execution completed for session ${sessionId}`);
            }

            this.logger.info(`[AUDIO-FLOW-19] Successfully processed transcript for session ${sessionId}`, {
                totalDuration: Date.now() - contextStartTime,
                responsePreview: response.text?.substring(0, 100)
            });

            // Clear typing status
            if (session.metadata?.grpcCall) {
                session.metadata.grpcCall.write({
                    typing_status: {
                        status: 'idle',
                        message: undefined
                    }
                });
            }

            return { llmResponse: response.text };

        } catch (error: any) {
            this.logger.error('Error in full flow, attempting graceful degradation', {
                sessionId,
                error: error.message
            });

            // Graceful degradation: try without RAG
            try {
                this.logger.info('Attempting LLM without RAG context', { sessionId });

                const simpleContext = {
                    transcript,
                    recentMessages: [],
                    relevantMemories: [],
                    systemPrompt: 'You are Gnani, a helpful AI assistant.',
                    userId: session.userId
                };

                const response = await this.llmExecutor.generate(
                    simpleContext,
                    session.onLlmChunkCallback
                );

                this.logger.info('Graceful degradation successful', { sessionId });
                return { llmResponse: response.text };

            } catch (degradedError: any) {
                // Last resort: return error message to user
                this.logger.error('All fallbacks failed', {
                    sessionId,
                    error: degradedError.message
                });

                const fallbackMessage = "I'm having trouble processing that right now. Please try again.";

                if (session.onLlmChunkCallback) {
                    try {
                        await session.onLlmChunkCallback(fallbackMessage);
                    } catch (callbackError: any) {
                        this.logger.error('Error sending fallback message', {
                            sessionId,
                            error: callbackError.message
                        });
                    }
                }
                return { llmResponse: fallbackMessage };
            }
        }
    }

    async processTextInput(sessionId: string, textInput: string): Promise<any> {
        this.logger.info(`Processing text input for session ${sessionId}: "${textInput.substring(0, 50)}..."`);
        const session = this.sessions.get(sessionId);
        if (!session) {
            this.logger.error(`Session ${sessionId} not found during text input processing.`);
            return null;
        }

        // Update last activity
        session.lastActivity = Date.now();
        this.resetSessionTimeout(sessionId);

        // Update Redis state
        sessionMemory.updateSessionState(sessionId, {
            lastActivity: Date.now(),
            isSpeaking: false
        }).catch(err => this.logger.error(`Failed to update Redis session state: ${err.message}`));

        // Notify callback about the input
        if (session.onTranscriptionCallback) {
            await session.onTranscriptionCallback(textInput, true);
        }

        // Process as final transcript
        return await this.handleFinalTranscript(sessionId, textInput);
    }

    async endSession(sessionId: string): Promise<boolean> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            this.logger.warn(`Attempted to end non-existent session: ${sessionId}`);
            return false;
        }

        // Cleanup timeout
        if (session.timeoutId) {
            clearTimeout(session.timeoutId);
        }

        // Cleanup audio processor
        await this.audioProcessor.cleanup(sessionId);

        // Clear Redis state
        sessionMemory.clearSessionCache(sessionId).catch(err =>
            this.logger.error(`Failed to clear Redis session cache: ${err.message}`)
        );

        // NEW: Trigger summarization on session end
        try {
            const memoryManager = await import('../memory/memory.manager.js');
            await memoryManager.default.checkAndTriggerSummarization((session as any).userId);
            this.logger.debug(`Triggered summarization check for user ${session.userId}`);
        } catch (error: any) {
            this.logger.warn(`Failed to trigger summarization: ${error.message}`);
        }

        this.sessions.delete(sessionId);

        this.logger.info(`Session ended: ${sessionId}`);
        metrics.activeSessionsGauge.dec();
        auditService.logEvent('SESSION_END', session.userId, sessionId, {}, 'success');

        return true;
    }

    private resetSessionTimeout(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        if (session.timeoutId) {
            clearTimeout(session.timeoutId);
        }

        session.timeoutId = setTimeout(() => {
            this.logger.warn(`Session timed out: ${sessionId}. Cleaning up.`);
            auditService.logEvent('SESSION_TIMEOUT', session.userId, sessionId, {}, 'warning');
            this.endSession(sessionId);
        }, this.SESSION_TIMEOUT_MS);

        session.lastActivity = Date.now();
    }

    getBufferStats(sessionId: string): { size: number; chunks: number } {
        return this.audioProcessor.getBufferStats(sessionId);
    }

    getActiveSessionCount(): number {
        return this.sessions.size;
    }
}

// Export singleton instance
export default new SessionCoordinator(
    new AudioProcessor(),
    new TranscriptProcessor(),
    new ContextBuilder(),
    new LLMExecutor(),
    new ToolExecutor()
);
