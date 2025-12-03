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
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        session.lastActivity = Date.now();
        this.resetSessionTimeout(sessionId);

        // Update Redis state (fire and forget)
        sessionMemory.updateSessionState(sessionId, {
            lastActivity: Date.now(),
            isSpeaking: true
        }).catch(err => this.logger.error(`Failed to update Redis session state: ${err.message}`));

        // Delegate to audio processor
        await this.audioProcessor.appendChunk(sessionId, audioChunk, sampleRate, 
            (transcript: string, isFinal: boolean) => {
                this.processTranscript(sessionId, transcript, isFinal);
            }
        );
    }

    async processTranscript(sessionId: string, transcript: string, isFinal: boolean): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        // Notify frontend
        await session.onTranscriptionCallback(transcript, isFinal);

        if (isFinal && transcript && transcript !== 'ACK') {
            // Process complete transcript
            await this.handleFinalTranscript(sessionId, transcript);
        }
    }

    private async handleFinalTranscript(sessionId: string, transcript: string): Promise<{ llmResponse: string } | void> {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        try {
            this.logger.info(`Processing final transcript for session ${sessionId}: "${transcript.substring(0, 50)}..."`);

            // Step 1: Build context (memory + RAG)
            this.logger.info(`Building context for session ${sessionId}...`);
            const context = await this.contextBuilder.build(sessionId, session.userId, transcript);
            this.logger.info(`Context built for session ${sessionId}. Calling LLMExecutor...`);

            // Step 2: Generate LLM response with Re-Act loop
            const response = await this.llmExecutor.generate(
                context,
                session.onLlmChunkCallback
            );
            this.logger.info(`LLMExecutor returned for session ${sessionId}.`);
            // Step 3: Execute tools if needed
            if (response.toolCalls && response.toolCalls.length > 0) {
                await this.toolExecutor.executeTools(
                    sessionId,
                    response.toolCalls,
                    session.onToolStatusCallback
                );
            }

            this.logger.info(`Successfully processed transcript for session ${sessionId}`);
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
