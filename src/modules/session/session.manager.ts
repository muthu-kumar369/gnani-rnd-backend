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
import { llmManager } from '../../core/llm/llm.manager.js'; // Phase 4: Use LLMManager
import llmResponseParser from '../llm/llm-response.parser.js';
import audioStreamer from '../../utils/audio.streamer.js';
import toolRegistry from '../tools/tool.registry.js';
import sessionMemory from '../memory/services/session-memory.service.js';
import latencyMonitor from '../../core/monitoring/latency.monitor.js';
import conversationService from '../conversation/conversation.service.js';
import { Logger } from 'winston';

export interface Session {
    userId: string;
    audioBuffer: Buffer[];
    lastActivity: number;
    timeoutId: NodeJS.Timeout | null;
    onTranscriptionCallback: (transcript: string, isFinal: boolean) => Promise<void> | void;
    onLlmChunkCallback?: (text: string) => Promise<void> | void;
    onToolStatusCallback?: (status: any) => Promise<void> | void;
    metadata: any;
    currentTranscription: string;
}

class SessionManager {
    private logger: Logger;
    private sessions: Map<string, Session>;
    private SESSION_TIMEOUT_MS: number;
    private MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB limit
    private BUFFER_WARNING_SIZE = 8 * 1024 * 1024; // 8MB warning (80% of max)

    constructor() {
        this.logger = createContextualLogger({ module: 'SessionManager' });
        this.sessions = new Map();
        this.SESSION_TIMEOUT_MS = 5 * 60 * 1000;
        setInterval(this.cleanupInactiveSessions.bind(this), 60 * 1000);
        this.logger.info('SessionManager initialized.');
        metrics.activeSessionsGauge.set(0);
    }

    async startSession(userId: string, onTranscriptionCallback: (transcript: string, isFinal: boolean) => Promise<void> | void, onLlmChunkCallback?: (text: string) => Promise<void> | void, onToolStatusCallback?: (status: any) => Promise<void> | void, existingSessionId?: string): Promise<string> {
        const sessionId = existingSessionId || uuidv4();
        if (existingSessionId) {
            this.logger.info(`Resuming existing session ID: ${sessionId}`);
        } else {
            this.logger.debug(`Generated new session ID: ${sessionId}`);
        }

        // Initialize in-memory session
        this.sessions.set(sessionId, {
            userId,
            audioBuffer: [],
            lastActivity: Date.now(),
            timeoutId: null,
            onTranscriptionCallback,
            onLlmChunkCallback,
            onToolStatusCallback,
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

            // Calculate current buffer size BEFORE appending
            const currentSize = session.audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
            const newSize = currentSize + audioChunk.length;

            // Check for buffer overflow
            if (newSize > this.MAX_BUFFER_SIZE) {
                this.logger.error('Audio buffer overflow detected', {
                    sessionId,
                    currentSize,
                    newSize,
                    maxSize: this.MAX_BUFFER_SIZE
                });
                
                // Auto-flush to prevent crash
                await this.flushAudioBuffer(sessionId);
                
                // Emit warning to frontend via callback
                if (session.onTranscriptionCallback) {
                    Promise.resolve(session.onTranscriptionCallback('⚠️ Audio buffer overflow - processing...', false)).catch(err => {
                        this.logger.error(`Error in overflow warning callback: ${err.message}`);
                    });
                }
                
                metrics.incrementAudioBufferOverflow(sessionId);
            }
            
            // Warning at 80% capacity
            if (newSize > this.BUFFER_WARNING_SIZE && currentSize <= this.BUFFER_WARNING_SIZE) {
                this.logger.warn('Audio buffer approaching limit', {
                    sessionId,
                    currentSize: newSize,
                    maxSize: this.MAX_BUFFER_SIZE,
                    percentFull: Math.round((newSize / this.MAX_BUFFER_SIZE) * 100)
                });
                metrics.incrementAudioBufferWarning(sessionId);
            }

            session.audioBuffer.push(audioChunk); // Directly push the audioChunk

            // Track buffer metrics
            // Track buffer metrics
            metrics.setAudioBufferSize(sessionId, newSize);

            whisperService.sendAudioChunk(sessionId, audioChunk, (transcript: string, isFinal: boolean) => {
                this.logger.debug(`[SessionManager] Raw transcript from Whisper for ${sessionId}: "${transcript}" (isFinal: ${isFinal})`);
                if (transcript === 'ACK') {
                    return; // Ignore ACK messages
                }
                session.currentTranscription = transcript;
                if (session.onTranscriptionCallback) {
                    // We don't await here because this is inside a callback from WhisperService which might not be async-aware
                    // However, for backpressure to work fully, we ideally should.
                    // For now, we just call it. If it returns a promise, we catch errors.
                    Promise.resolve(session.onTranscriptionCallback(transcript, isFinal)).catch(err => {
                        this.logger.error(`Error in onTranscriptionCallback for session ${sessionId}: ${err.message}`);
                    });
                }
            }, false);
            this.logger.debug(`Appended audio chunk to session ${sessionId}. Buffer size: ${newSize} bytes (${session.audioBuffer.length} chunks)`);
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
            this.logger.debug(`Audio buffer cleared for session: ${sessionId}`);
            metrics.setAudioBufferSize(sessionId, 0);
        }
    }

    /**
     * Flush audio buffer to Whisper service
     * Used for overflow protection and manual flushing
     */
    private async flushAudioBuffer(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session || session.audioBuffer.length === 0) return;
        
        this.logger.info('Flushing audio buffer', { 
            sessionId,
            bufferSize: session.audioBuffer.reduce((sum, buf) => sum + buf.length, 0),
            chunks: session.audioBuffer.length
        });
        
        // Process accumulated audio
        const combinedBuffer = Buffer.concat(session.audioBuffer);
        
        // Send to Whisper for transcription
        whisperService.sendAudioChunk(sessionId, combinedBuffer, (transcript: string, isFinal: boolean) => {
            if (session.onTranscriptionCallback && transcript !== 'ACK') {
                Promise.resolve(session.onTranscriptionCallback(transcript, true)).catch(err => {
                    this.logger.error(`Error in flush callback: ${err.message}`);
                });
            }
        }, true);
        
        // Clear buffer
        session.audioBuffer = [];
        // Clear buffer
        session.audioBuffer = [];
        metrics.setAudioBufferSize(sessionId, 0);
    }

    /**
     * Get buffer statistics for monitoring
     */
    getBufferStats(sessionId: string): { size: number; chunks: number } {
        const session = this.sessions.get(sessionId);
        if (!session) return { size: 0, chunks: 0 };
        
        const size = session.audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
        return { size, chunks: session.audioBuffer.length };
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
            whisperService.sendAudioChunk(sessionId, Buffer.alloc(0), async (transcript: string, isFinal: boolean) => {
                session.currentTranscription = transcript;
                if (isFinal) {
                    if (session.onTranscriptionCallback) {
                        await session.onTranscriptionCallback(transcript, isFinal);
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

        let processedText = textInput;
        let imageData = null;

        // Check if input is a JSON string (potential image or multi-modal data)
        try {
            if (textInput.trim().startsWith('{')) {
                const parsed = JSON.parse(textInput);
                if (parsed.type === 'image' && parsed.content) {
                    this.logger.info(`Detected image input for session ${sessionId}`);
                    processedText = "Analyze this image."; // Default prompt for image
                    imageData = {
                        data: parsed.content,
                        mimeType: parsed.mimeType || 'image/png'
                    };
                }
            }
        } catch (e) {
            // Not JSON, treat as normal text
        }

        // Notify callback about the input (simulating STT result)
        if (session.onTranscriptionCallback) {
            await session.onTranscriptionCallback(processedText, true);
        }

        return this.processQueryAndGenerateResponse(sessionId, processedText, imageData);
    }

    private async processQueryAndGenerateResponse(sessionId: string, textInput: string, imageData: any = null): Promise<any> {
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
            toolDefinitions, // Pass tools to prompt
            imageData // Pass image data
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
                // Phase 4: Use LLMManager for generation
                let fullResponse = '';
                const stream = llmManager.generate(currentPrompt, {
                    stream: true,
                    temperature: 0.7
                });

                for await (const chunk of stream) {
                    fullResponse += chunk;
                    if (session.onLlmChunkCallback) {
                        await session.onLlmChunkCallback(chunk);
                    }
                }

                const trimmedResponse = fullResponse.trim();
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
                    const result = await toolRegistry.executeTool(toolCall.tool, toolCall.params, session.onToolStatusCallback);
                    this.logger.info(`Tool execution result: ${JSON.stringify(result)}`);

                    // Enrich prompt with result for next turn
                    currentPrompt = contextEngine.enrichPromptWithToolResult(currentPrompt, result);

                    // Continue loop to get next LLM response
                    continue;
                } else {
                    // Final Response (No tool needed)
                    // We need to construct a response object similar to what llmResponseParser expects
                    // or just use the text directly since we already have it.
                    // The parser was mainly for parsing the raw Ollama response object.
                    // Since llmManager returns string, we can simplify.

                    llmResponseText = fullResponse;

                    // Attempt to parse action directives if any (legacy support)
                    const parsed = llmResponseParser.parse({ text: fullResponse });
                    if (parsed.actionInstructions) {
                        actionDirective = parsed.actionInstructions;
                    }

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

        // Ensure conversation exists in DB (for history list)
        conversationService.ensureConversation(sessionId, session.userId).catch(err => {
            this.logger.error(`Error ensuring conversation exists: ${err.message}`);
        });

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

        // Log latency report for this conversation turn
        latencyMonitor.logReport(sessionId);
        latencyMonitor.clearSession(sessionId);

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
