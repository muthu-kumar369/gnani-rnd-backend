// src/services/sessionManager.ts
import { v4 as uuidv4 } from 'uuid';
import { createContextualLogger } from '../../core/logger/logger.js';
import metrics from '../../core/monitoring/metrics.js';
import auditService from '../../core/logger/audit.service.js';
import whisperService from '../asr/whisper.service.js';
import audioProcessor from '../../utils/audio.processor.js';
import queryProcessor from '../query/query.processor.js';
import contextEngine from '../context/context.engine.js';
import actionDispatcher from '../action/action-dispatcher.service.js';
import llmService from '../llm/llm.service.js';
import llmResponseParser from '../llm/llm-response.parser.js';
import audioStreamer from '../../utils/audio.streamer.js';
import toolRegistry from '../tools/tool.registry.js';
import sessionMemory from '../memory/services/session-memory.service.js';
import { Logger } from 'winston';

interface Session {
    userId: string;
    audioBuffer: Buffer[];
    lastActivity: number;
    timeoutId: NodeJS.Timeout | null;
    onTranscriptionCallback: (transcript: string, isFinal: boolean) => void;
    onLlmChunkCallback?: (text: string) => void;
    metadata: any;
    currentTranscription: string;
}

class SessionManager {
    private logger: Logger;
    private sessions: Map<string, Session>;
    private SESSION_TIMEOUT_MS: number;

    constructor() {
        this.logger = createContextualLogger({ module: 'SessionManager' });
        this.sessions = new Map();
        this.SESSION_TIMEOUT_MS = 5 * 60 * 1000;
        setInterval(this.cleanupInactiveSessions.bind(this), 60 * 1000);
        this.logger.info('SessionManager initialized.');
        metrics.activeSessionsGauge.set(0);
    }

    async startSession(userId: string, onTranscriptionCallback: (transcript: string, isFinal: boolean) => void, onLlmChunkCallback?: (text: string) => void): Promise<string> {
        const sessionId = uuidv4();
        this.logger.debug(`Generated new session ID: ${sessionId}`);

        // Initialize in-memory session
        this.sessions.set(sessionId, {
            userId,
            audioBuffer: [],
            lastActivity: Date.now(),
            timeoutId: null,
            onTranscriptionCallback,
            onLlmChunkCallback,
            metadata: {},
            currentTranscription: ''
        });

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

    async appendAudioChunk(sessionId: string, audioChunk: Buffer, inputSampleRate: number): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastActivity = Date.now();
            this.resetSessionTimeout(sessionId);

            // Update Redis state (fire and forget to avoid latency)
            sessionMemory.updateSessionState(sessionId, {
                lastActivity: Date.now(),
                isSpeaking: true
            }).catch(err => this.logger.error(`Failed to update Redis session state: ${err.message}`));

            session.audioBuffer.push(audioChunk); // Directly push the audioChunk

            whisperService.sendAudioChunk(sessionId, audioChunk, (transcript: string, isFinal: boolean) => {
                this.logger.debug(`[SessionManager] Raw transcript from Whisper for ${sessionId}: "${transcript}" (isFinal: ${isFinal})`);
                if (transcript === 'ACK') {
                    return; // Ignore ACK messages
                }
                session.currentTranscription = transcript;
                if (session.onTranscriptionCallback) {
                    session.onTranscriptionCallback(transcript, isFinal);
                }
            }, false);
            this.logger.debug(`Appended audio chunk to session ${sessionId}. Buffer size: ${session.audioBuffer.length}`);
        } else {
            this.logger.warn(`Attempted to append audio to non-existent session: ${sessionId}`);
            auditService.logEvent('AUDIO_CHUNK_APPEND', null, sessionId, { reason: 'Session not found' }, 'failure');
        }
    }

    clearAudioBuffer(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.audioBuffer = [];
            this.logger.debug(`Audio buffer cleared for session: ${sessionId}`);
        }
    }

    endSession(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (session) {
            if (session.timeoutId) clearTimeout(session.timeoutId);
            this.sessions.delete(sessionId);
            whisperService.cleanupSession(sessionId);
            queryProcessor.clearSessionMemory(sessionId);
            audioStreamer.cleanupSession(sessionId);

            // Clean up memory system caches and Redis session state
            import('../memory/memory.manager.js').then(module => {
                module.default.clearSessionCache(sessionId).catch((err: any) => {
                    this.logger.error(`Error clearing session memory: ${err.message}`);
                });
            });

            // Clear Redis state
            sessionMemory.clearSessionCache(sessionId).catch(err =>
                this.logger.error(`Failed to clear Redis session cache: ${err.message}`)
            );

            this.logger.info(`Session ended: ${sessionId}`);
            metrics.activeSessionsGauge.dec(); // Corrected from inc() to dec()
            auditService.logEvent('SESSION_END', session.userId, sessionId, {}, 'success');
            return true;
        }
        this.logger.warn(`Attempted to end non-existent session: ${sessionId}`);
        auditService.logEvent('SESSION_END', null, sessionId, { reason: 'Session not found' }, 'failure');
        return false;
    }

    resetSessionTimeout(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            if (session.timeoutId) {
                clearTimeout(session.timeoutId);
            }
            session.timeoutId = setTimeout(() => {
                this.logger.warn(`Session timed out: ${sessionId}. Cleaning up.`);
                auditService.logEvent('SESSION_TIMEOUT', session.userId, sessionId, {}, 'warning');
                this.endSession(sessionId);
            }, this.SESSION_TIMEOUT_MS);
        }
    }

    cleanupInactiveSessions(): void {
        const now = Date.now();
        for (const [sessionId, session] of this.sessions.entries()) {
            if (now - session.lastActivity > this.SESSION_TIMEOUT_MS) {
                this.logger.warn(`Inactive session ${sessionId} detected. Cleaning up.`);
                auditService.logEvent('SESSION_INACTIVE_CLEANUP', session.userId, sessionId, {}, 'warning');
                this.endSession(sessionId);
            }
        }
    }

    async finalizeSessionProcessing(sessionId: string): Promise<any> {
        this.logger.debug(`Finalizing session processing for session ${sessionId}`);
        const session = this.sessions.get(sessionId);
        if (!session) {
            this.logger.error(`Session ${sessionId} not found during finalization.`);
            auditService.logEvent('SESSION_FINALIZE', null, sessionId, { reason: 'Session not found' }, 'failure');
            return {
                cleanedText: '',
                intent: 'error',
                llmResponse: 'Error: Session not found',
                actionDirective: null,
                cacheHit: false
            };
        }

        const fullAudioBuffer = Buffer.concat(session.audioBuffer);

        await new Promise<void>(resolve => {
            // Send an empty buffer with isLastChunk=true to trigger final transcription
            whisperService.sendAudioChunk(sessionId, Buffer.alloc(0), (transcript: string, isFinal: boolean) => {
                session.currentTranscription = transcript;
                if (isFinal) {
                    if (session.onTranscriptionCallback) {
                        session.onTranscriptionCallback(transcript, isFinal);
                    }
                    resolve();
                }
            }, true);
        });

        const finalTranscription = session.currentTranscription;
        this.clearAudioBuffer(sessionId);

        return this.processQueryAndGenerateResponse(sessionId, finalTranscription);
    }

    async processTextInput(sessionId: string, textInput: string): Promise<any> {
        this.logger.info(`Processing text input for session ${sessionId}: "${textInput}"`);
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

        // Notify callback about the input (simulating STT result)
        if (session.onTranscriptionCallback) {
            session.onTranscriptionCallback(textInput, true);
        }

        return this.processQueryAndGenerateResponse(sessionId, textInput);
    }

    private async processQueryAndGenerateResponse(sessionId: string, textInput: string): Promise<any> {
        const session = this.sessions.get(sessionId);
        if (!session) return null;

        const processedQuery = await queryProcessor.processTranscript(
            sessionId,
            session.userId,
            textInput
        );

        // --- INTEGRATED TOOL ROUTING (PHASE 2) ---

        // 1. Get available tools
        const toolDefinitions = toolRegistry.getToolDefinitions();

        // 2. Build Prompt with Tools
        const llmPrompt = await contextEngine.buildLLMPrompt(
            sessionId,
            session.userId,
            processedQuery,
            toolDefinitions // Pass tools to prompt
        );

        let llmResponseText = '';
        let actionDirective = null;
        let currentPrompt = llmPrompt;
        let turnCount = 0;
        const MAX_TURNS = 5;

        this.logger.info(`Starting Re-Act loop for session ${sessionId}`);

        while (turnCount < MAX_TURNS) {
            turnCount++;
            this.logger.debug(`Re-Act Turn ${turnCount}/${MAX_TURNS}`);

            try {
                const llmRawResponse = await llmService.getLlmResponse(currentPrompt, (partialResponse: any) => {
                    if (session.onLlmChunkCallback) {
                        session.onLlmChunkCallback(partialResponse);
                    }
                });

                const trimmedResponse = llmRawResponse.text.trim();
                let toolCall = null;

                // Enhanced Tool Call Detection with multiple extraction strategies
                if (trimmedResponse.includes('"tool"') || trimmedResponse.includes('```json')) {
                    let jsonContent = trimmedResponse;

                    // Strategy 1: Extract from markdown code block
                    const markdownMatch = trimmedResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                    if (markdownMatch) {
                        jsonContent = markdownMatch[1].trim();
                        this.logger.debug(`Extracted JSON from markdown code block: ${jsonContent}`);
                    }
                    // Strategy 2: Find first { to last }
                    else if (trimmedResponse.includes('{')) {
                        const firstBrace = trimmedResponse.indexOf('{');
                        const lastBrace = trimmedResponse.lastIndexOf('}');
                        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                            jsonContent = trimmedResponse.substring(firstBrace, lastBrace + 1);
                            this.logger.debug(`Extracted JSON from braces: ${jsonContent}`);
                        }
                    }

                    // Try to parse the extracted JSON
                    try {
                        const parsed = JSON.parse(jsonContent);

                        // Validate that it has required fields and tool exists in registry
                        if (parsed.tool && parsed.params !== undefined) {
                            // Check if tool exists in registry
                            const toolExists = toolRegistry.getTool(parsed.tool);
                            if (toolExists) {
                                toolCall = parsed;
                                this.logger.info(`Valid tool call detected: ${parsed.tool}`);
                            } else {
                                this.logger.warn(`Tool "${parsed.tool}" not found in registry. Available tools: ${toolRegistry.getAllTools().map(t => t.name).join(', ')}`);
                            }
                        }
                    } catch (e) {
                        this.logger.warn(`Failed to parse potential tool call JSON: ${e}. Content: ${jsonContent.substring(0, 100)}`);
                    }
                }

                if (toolCall) {
                    this.logger.info(`Tool execution triggered: ${toolCall.tool}`);
                    console.log(`[ToolLayer] Executing tool: ${toolCall.tool}`);

                    // Execute Tool
                    const result = await toolRegistry.executeTool(toolCall.tool, toolCall.params);
                    this.logger.info(`Tool execution result: ${JSON.stringify(result)}`);

                    // Enrich prompt with result for next turn
                    currentPrompt = contextEngine.enrichPromptWithToolResult(currentPrompt, result);

                    // Continue loop to get next LLM response
                    continue;
                } else {
                    // Final Response (No tool needed)
                    const parsed = llmResponseParser.parse(llmRawResponse);
                    llmResponseText = parsed.textResponse;
                    actionDirective = parsed.actionInstructions;
                    break; // Exit loop
                }

            } catch (llmError: any) {
                this.logger.error(`Error during LLM call for session ${sessionId}: ${llmError.message}`);
                auditService.logLlmEvent(session.userId, sessionId, currentPrompt, null, 'failure', llmError.message);
                llmResponseText = "I'm sorry, I encountered an error while processing your request.";
                break;
            }
        }

        if (turnCount >= MAX_TURNS) {
            this.logger.warn(`Re-Act loop reached max turns (${MAX_TURNS}) for session ${sessionId}`);
            llmResponseText = "I'm sorry, I'm having trouble completing this request. It seems a bit too complex.";
        }

        auditService.logLlmEvent(session.userId, sessionId, currentPrompt, { text: llmResponseText }, 'success');

        if (actionDirective && actionDirective.action) {
            this.logger.info(`Attempting to dispatch action for session ${sessionId}: ${JSON.stringify(actionDirective)}`);
            const actionResult = await actionDispatcher.dispatch(session.userId, actionDirective, sessionId);
            if (actionResult.success) {
                this.logger.info(`Action dispatched successfully for session ${sessionId}: ${actionResult.message}`);
                llmResponseText += ` (Action executed: ${actionResult.message})`;
            } else {
                this.logger.warn(`Action dispatch failed for session ${sessionId}: ${actionResult.message}`);
                llmResponseText += ` (Action failed: ${actionResult.message})`;
                actionDirective = null;
            }
        } else {
            this.logger.info(`No action to dispatch for session ${sessionId}.`);
        }

        if (llmResponseText) {
            // TTS generation removed. Text is streamed directly via onLlmChunkCallback or returned in final response.
            this.logger.info(`LLM response generated for session ${sessionId}: ${llmResponseText.substring(0, 50)}...`);
        }

        // Store interaction in memory system (fire-and-forget to not block response)
        import('../memory/memory.manager.js').then(module => {
            module.default.storeInteraction(
                session.userId,
                sessionId,
                processedQuery.cleanedText,
                llmResponseText,
                {
                    intent: processedQuery.intent,
                    action: actionDirective,
                    cacheHit: processedQuery.cacheHit
                }
            ).catch(err => {
                this.logger.error(`Error storing interaction in memory: ${err.message}`);
            });
        }).catch(err => {
            this.logger.error(`Error importing memory manager: ${err.message}`);
        });

        // Keep old in-memory storage for backward compatibility (will be deprecated)
        queryProcessor.addInteractionToMemory(sessionId, processedQuery.cleanedText, llmResponseText);

        auditService.logEvent('SESSION_FINALIZE', session.userId, sessionId, { finalTranscription: textInput, llmResponseText, actionDirective }, 'success');

        return {
            cleanedText: processedQuery.cleanedText,
            intent: processedQuery.intent,
            llmResponse: llmResponseText,
            actionDirective: actionDirective,
            cacheHit: processedQuery.cacheHit
        };
    }
}

export default new SessionManager();
