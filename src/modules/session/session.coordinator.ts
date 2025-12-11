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
import sessionPersistence from './session.persistence.js';
import assistantStateMachine from '../../core/state-machine/assistant.machine.js';
import { AssistantEvent, AssistantState } from '../../core/state-machine/assistant-states.js';
import { validateMessage } from '../conversation/message-validator.js'; // STAGE 1

export interface Session {
    userId: string;
    conversationId: string;  // Permanent conversation ID (for database)
    createdAt: number;
    lastActivity: number;
    timeoutId: NodeJS.Timeout | null;
    onTranscriptionCallback: (transcript: string, isFinal: boolean) => Promise<void> | void;
    onLlmChunkCallback?: (text: string, messageId?: string) => Promise<void> | void;
    onLlmCompleteCallback?: (text: string, messageId?: string) => Promise<void> | void;
    onToolStatusCallback?: (status: any) => Promise<void> | void;
    metadata: any;
}

export class SessionCoordinator {
    private logger: Logger;
    private sessions: Map<string, Session> = new Map();
    private abortControllers: Map<string, AbortController> = new Map(); // Track controllers for cancellation
    private SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    private checkpointCounters: Map<string, number> = new Map();

    constructor(
        private audioProcessor: AudioProcessor,
        private transcriptProcessor: TranscriptProcessor,
        private contextBuilder: ContextBuilder,
        private llmExecutor: LLMExecutor,
        private toolExecutor: ToolExecutor
    ) {
        this.logger = createContextualLogger({ module: 'SessionCoordinator' });
        this.logger.info('SessionCoordinator initialized');

        // Stage 11: Listen to state machine events
        assistantStateMachine.on('stateChange', ({ from, to, event }) => {
            this.logger.info(`State transition: ${from} → ${to} (${event})`);
            // TODO: Broadcast to frontend via gRPC if needed
        });
    }

    async startSession(
        userId: string,
        onTranscriptionCallback: (transcript: string, isFinal: boolean) => Promise<void> | void,
        onLlmChunkCallback?: (text: string, messageId?: string) => Promise<void> | void,
        onLlmCompleteCallback?: (text: string, messageId?: string) => Promise<void> | void,
        onToolStatusCallback?: (status: any) => Promise<void> | void,
        existingSessionId?: string,
        conversationId?: string  // NEW: Accept existing conversationId
    ): Promise<{ sessionId: string; conversationId: string }> {  // NEW: Return both IDs
        const sessionId = existingSessionId || uuidv4();
        const convId = conversationId || uuidv4();  // NEW: Generate or reuse conversationId

        if (existingSessionId) {
            this.logger.info(`Resuming existing session ID: ${sessionId}`);
        } else {
            this.logger.debug(`Generated new session ID: ${sessionId}`);
        }

        if (conversationId) {
            this.logger.info(`Using existing conversation ID: ${convId}`);
        } else {
            this.logger.debug(`Generated new conversation ID: ${convId}`);
        }

        const session: Session = {
            userId,
            conversationId: convId,  // NEW: Store conversationId
            createdAt: Date.now(),
            lastActivity: Date.now(),
            timeoutId: null,
            onTranscriptionCallback,
            onLlmChunkCallback,
            onLlmCompleteCallback,
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
                conversationId: convId,  // NEW: Store conversationId in Redis
                lastActivity: Date.now(),
                isSpeaking: false
            });
        } catch (error: any) {
            this.logger.error(`Failed to persist session state to Redis: ${error.message}`);
        }

        // Ensure Conversation document exists in MongoDB to prevent 404s on frontend
        try {
            const conversationExists = await Conversation.exists({ conversationId: convId });  // NEW: Use conversationId
            if (!conversationExists) {
                await Conversation.create({
                    userId,
                    conversationId: convId,  // NEW: Use conversationId for database
                    title: 'New Conversation',
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                this.logger.info(`Created new Conversation document for conversationId ${convId}`);
            }
        } catch (error: any) {
            this.logger.error(`Failed to create Conversation document: ${error.message}`);
        }

        this.resetSessionTimeout(sessionId);
        this.logger.info(`Session started: ${sessionId}, conversationId: ${convId} for user ${userId}`);
        metrics.activeSessionsGauge.inc();
        auditService.logEvent('SESSION_START', userId, sessionId, { conversationId: convId }, 'success');

        // Stage 11: Activate state machine
        try {
            assistantStateMachine.transition(AssistantEvent.ACTIVATE);
            this.logger.debug(`State machine activated for session ${sessionId}`);
        } catch (error: any) {
            this.logger.warn(`State machine transition failed: ${error.message}`);
        }

        // Stage 1: Persist to MongoDB
        try {
            await sessionPersistence.saveSession({
                sessionId,
                userId,
                conversationId: convId,
                state: 'IDLE', // State machine: assistantStateMachine.getCurrentState()
                audioBuffer: null,
                pendingTranscript: null,
                contextSnapshot: null,
                llmState: null,
                createdAt: new Date(),
                lastActivity: new Date(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                metadata: { grpcCallActive: false, deviceInfo: null }
            });
            this.logger.debug(`Session persisted to MongoDB: ${sessionId}`);
        } catch (error: any) {
            this.logger.error(`Failed to persist session to MongoDB: ${error.message}`);
        }

        return { sessionId, conversationId: convId };  // NEW: Return both IDs
    }

    getSession(sessionId: string): Session | undefined {
        const session = this.sessions.get(sessionId);
        if (session) {
            this.resetSessionTimeout(sessionId);
        }
        return session;
    }

    async recoverSession(sessionId: string): Promise<Session | null> {
        // Check if session exists in Redis
        const state = await sessionMemory.getSessionState(sessionId);
        if (!state || !state.userId) {
            return null;
        }

        this.logger.info(`Recovering session ${sessionId} from Redis state`);

        // Reconstruct session object
        const session: Session = {
            userId: state.userId,
            conversationId: state.conversationId || sessionId, // Use stored convId or fallback
            createdAt: Date.now(), // Approximate
            lastActivity: Date.now(),
            timeoutId: null,
            // Callbacks will be re-attached by the caller (gRPC handler)
            onTranscriptionCallback: async () => { },
            onLlmChunkCallback: async () => { },
            onLlmCompleteCallback: async () => { },
            onToolStatusCallback: async () => { },
            metadata: state.metadata || {}
        };

        this.sessions.set(sessionId, session);

        // Re-initialize components
        await this.audioProcessor.initialize(sessionId);
        this.resetSessionTimeout(sessionId);

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

        // Stage 11: Transition to LISTENING state when audio starts
        try {
            if (assistantStateMachine.isInState(AssistantState.IDLE)) {
                assistantStateMachine.transition(AssistantEvent.SPEECH_START);
                this.logger.debug(`State machine: IDLE → LISTENING (audio chunk received)`);
            }
        } catch (error: any) {
            this.logger.warn(`State machine transition failed: ${error.message}`);
        }

        session.lastActivity = Date.now();
        this.resetSessionTimeout(sessionId);

        // Update Redis state (fire and forget)
        sessionMemory.updateSessionState(sessionId, {
            lastActivity: Date.now(),
            isSpeaking: true
        }).catch(err => this.logger.error(`Failed to update Redis session state: ${err.message}`));

        // Stage 1: Checkpoint every 10 chunks
        if (this.shouldCheckpoint(sessionId)) {
            this.checkpointSession(sessionId).catch((err: any) =>
                this.logger.error(`Failed to checkpoint session: ${err.message}`)
            );
        }

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

        // Filter out invalid transcripts (noise, non-speech sounds)
        if (!this.isValidTranscript(transcript)) {
            this.logger.info(`[AUDIO-FLOW-FILTER] Skipping invalid transcript`, {
                sessionId,
                transcript: transcript.substring(0, 100),
                reason: 'Invalid/noise transcript detected'
            });
            return;
        }

        // Stage 11: Transition to PROCESSING state when transcript is ready
        if (isFinal) {
            try {
                assistantStateMachine.transition(AssistantEvent.TRANSCRIPT_READY);
                this.logger.debug(`State machine: LISTENING → PROCESSING (transcript ready)`);
            } catch (error: any) {
                this.logger.warn(`State machine transition failed: ${error.message}`);
            }
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

    private async handleFinalTranscript(sessionId: string, transcript: string, options?: { targetMessageId?: string, skipUserPersistence?: boolean }): Promise<{ llmResponse: string } | void> {
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

            // Step 1: Fetch conversation to get custom system prompt, current model, and current template
            const conversation = await Conversation.findOne({ conversationId: session.conversationId }).lean();
            const customSystemPrompt = conversation?.systemPrompt;
            const currentModel = conversation?.currentModel || 'gemma:2b'; // Default to gemma:2b
            const currentTemplateId = conversation?.currentTemplate;

            this.logger.info(`[MODEL-TEMPLATE] Using model: ${currentModel}, template: ${currentTemplateId || 'default'}`);

            // If template is specified, fetch its system prompt
            let templateSystemPrompt = customSystemPrompt;
            if (currentTemplateId) {
                try {
                    const templateService = await import('../template/template.service.js');
                    const template = await templateService.templateService.findById(currentTemplateId, session.userId);
                    if (template?.systemPrompt) {
                        templateSystemPrompt = template.systemPrompt;
                        this.logger.info(`[TEMPLATE] Using template system prompt from: ${template.name}`);
                    }
                } catch (templateError: any) {
                    this.logger.warn(`Failed to fetch template ${currentTemplateId}: ${templateError.message}`);
                    // Continue with custom system prompt or default
                }
            }

            // Save User Message to MongoDB (only if not skipping persistence)
            let userMessageDoc: any = null;
            if (!options?.skipUserPersistence) {
                try {
                    // FALLBACK SAFEGUARD: Ensure we have valid IDs
                    const convIdToSave = session.conversationId || sessionId;
                    const genIdToSave = uuidv4();

                    // Find previous message to link
                    const lastMessage = await ConversationMessage.findOne({ conversationId: convIdToSave })
                        .sort({ timestamp: -1 });

                    const targetParentId = lastMessage ? lastMessage._id.toString() : null;

                    // STAGE 1: Validate before creating user message
                    await validateMessage({
                        parentId: targetParentId || undefined,
                        conversationId: convIdToSave,
                        role: 'user',
                        content: transcript
                    });

                    userMessageDoc = await ConversationMessage.create({
                        userId: session.userId,
                        conversationId: convIdToSave, // Use fallback if needed
                        role: 'user',
                        content: transcript,
                        timestamp: new Date(),
                        generationId: genIdToSave,
                        status: 'completed',
                        version: 1,
                        parentId: targetParentId
                    });

                    // Update parent's children
                    if (lastMessage) {
                        await ConversationMessage.findByIdAndUpdate(lastMessage._id, {
                            $push: { children: userMessageDoc._id.toString() }
                        });
                    }

                    this.logger.info(`[persistence] Saved user message ${userMessageDoc._id}`, {
                        parentId: lastMessage ? lastMessage._id : 'root'
                    });

                } catch (dbError: any) {
                    this.logger.error(`Failed to save user message: ${dbError.message}`);
                    try {
                        const fs = await import('fs');
                        fs.appendFileSync('db_persistence_errors.log', `${new Date().toISOString()} - User Message Error: ${dbError.message}\n`);
                    } catch (e) { /* ignore */ }
                }
            } else {
                this.logger.info(`[persistence] Skipping user message save (Regeneration/Edit context)`);
                // If skipping persistence (e.g. edit), we might need to find the target message to link assistant response to
                // But typically options.targetMessageId handles the ASSISTANT message update/creation
                // For 'Edit', the User message is ALREADY saved and passed in... wait.
                // In 'processTextInput' for Edit, we pass 'skipUserPersistence: true'.
                // But we need the 'userMessageId' to link the Assistant response!
                // The Caller (ConversationService.editMessage) sets parentId in the Assistant message it creates.
                // But here we create a NEW assistant message if options.targetMessageId is NOT set?
                // Wait, ConversationService.editMessage calls processTextInput with targetMessageId set to the NEW pending response.
                // So handleFinalTranscript updates that message.
            }

            // Step 2: Build context (memory + RAG)
            this.logger.info(`[AUDIO-FLOW-13] Building context for session ${sessionId}...`);

            // Stage 11: Transition to THINKING state
            try {
                assistantStateMachine.transition(AssistantEvent.CONTEXT_READY);
                this.logger.debug(`State machine: PROCESSING → THINKING (building context)`);
            } catch (error: any) {
                this.logger.warn(`State machine transition failed: ${error.message}`);
            }

            const contextStartTime = Date.now();
            const context = await this.contextBuilder.build(
                sessionId,
                session.userId,
                transcript,
                undefined, // attachments
                templateSystemPrompt // Use template's system prompt if available
            );
            const contextDuration = Date.now() - contextStartTime;
            this.logger.info(`[AUDIO-FLOW-14] Context built for session ${sessionId}`, {
                duration: contextDuration,
                hasContext: !!context,
                customPrompt: !!templateSystemPrompt,
                usingTemplate: !!currentTemplateId
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

            // Step 3: Generate LLM response
            this.logger.info(`[AUDIO-FLOW-15] Calling LLMExecutor.generate for session ${sessionId}...`);

            // Stage 11: Transition to GENERATING state
            try {
                assistantStateMachine.transition(AssistantEvent.LLM_START);
                this.logger.debug(`State machine: THINKING → GENERATING (starting LLM)`);
            } catch (error: any) {
                this.logger.warn(`State machine transition failed: ${error.message}`);
            }

            // Emit typing status: generating
            if (session.metadata?.grpcCall) {
                session.metadata.grpcCall.write({
                    typing_status: {
                        status: 'generating',
                        message: undefined
                    }
                });
            }

            // Create AbortController for this generation
            const controller = new AbortController();
            this.abortControllers.set(sessionId, controller);

            const llmStartTime = Date.now();
            let response;
            try {
                response = await this.llmExecutor.generate(
                    context,
                    session.onLlmChunkCallback,
                    currentModel, // Pass the model to use
                    controller.signal // Pass the abort signal
                );
            } catch (error) {
                if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted') || error.message.includes('canceled'))) {
                    this.logger.info(`LLM generation aborted for session ${sessionId}`);
                    return; // Stop processing further
                }
                throw error;
            } finally {
                // Cleanup controller
                this.abortControllers.delete(sessionId);
            }

            const llmDuration = Date.now() - llmStartTime;
            this.logger.info(`[AUDIO-FLOW-16] LLMExecutor returned for session ${sessionId}`, {
                duration: llmDuration,
                responseLength: response?.text?.length || 0,
                hasToolCalls: !!(response?.toolCalls?.length),
                modelUsed: currentModel
            });

            // Stage 11: Transition to SPEAKING state (LLM complete)
            try {
                assistantStateMachine.transition(AssistantEvent.LLM_COMPLETE);
                this.logger.debug(`State machine: GENERATING → SPEAKING (LLM complete)`);
            } catch (error: any) {
                this.logger.warn(`State machine transition failed: ${error.message}`);
            }

            // Save Assistant Message to MongoDB
            let finalMessageId = options?.targetMessageId;
            try {
                // FALLBACK SAFEGUARD: Ensure we have valid IDs
                const convIdToSave = session.conversationId || sessionId;
                const genIdToSave = uuidv4();

                this.logger.info(`[persistence] Saving assistant message`, {
                    userId: session.userId,
                    sessionId: convIdToSave,
                    originalSessionId: sessionId,
                    originalConversationId: session.conversationId
                });

                if (options?.targetMessageId) {
                    this.logger.info(`[persistence] Updating existing assistant message: ${options.targetMessageId}`);
                    await ConversationMessage.findByIdAndUpdate(options.targetMessageId, {
                        content: response.text,
                        status: 'completed',
                        tokenUsage: response.tokenUsage ? {
                            inputTokens: response.tokenUsage.promptTokens,
                            outputTokens: response.tokenUsage.completionTokens,
                            totalTokens: response.tokenUsage.totalTokens,
                            estimatedCost: 0,
                            model: currentModel
                        } : undefined
                    });
                    finalMessageId = options.targetMessageId;
                } else {
                    // Determine parent ID: should be the User Message we just created
                    // If we skipped user persistence, do we have a parent?
                    // In normal flow, userMessageDoc is set.
                    const parentId = userMessageDoc ? userMessageDoc._id.toString() : null;

                    // STAGE 1: Validate before creating assistant message
                    await validateMessage({
                        parentId,
                        conversationId: convIdToSave,
                        role: 'assistant',
                        content: response.text
                    });

                    const newMsg = await ConversationMessage.create({
                        userId: session.userId,
                        conversationId: convIdToSave, // Use fallback if needed
                        role: 'assistant',
                        content: response.text,
                        timestamp: new Date(),
                        generationId: genIdToSave,
                        status: 'completed',
                        version: 1,
                        parentId: parentId, // Link to user message
                        tokenUsage: response.tokenUsage ? {
                            inputTokens: response.tokenUsage.promptTokens,
                            outputTokens: response.tokenUsage.completionTokens,
                            totalTokens: response.tokenUsage.totalTokens,
                            estimatedCost: 0,
                            model: currentModel
                        } : undefined
                    });

                    // Update User Message children
                    if (userMessageDoc) {
                        await ConversationMessage.findByIdAndUpdate(userMessageDoc._id, {
                            $push: { children: newMsg._id.toString() }
                        });
                    }

                    finalMessageId = newMsg._id.toString();
                }
            } catch (dbError: any) {
                this.logger.error(`Failed to save assistant message: ${dbError.message}`);
                try {
                    const fs = await import('fs');
                    fs.appendFileSync('db_persistence_errors.log', `${new Date().toISOString()} - Assistant Message Error: ${dbError.message}\n`);
                } catch (e) { /* ignore */ }
            }

            // Step 4: Execute tools if needed
            if (response.toolCalls && response.toolCalls.length > 0) {
                this.logger.info(`[AUDIO-FLOW-17] Executing ${response.toolCalls.length} tool(s) for session ${sessionId}`);

                // Stage 11: Transition to TOOL_EXECUTING state
                try {
                    assistantStateMachine.transition(AssistantEvent.TOOL_START);
                    this.logger.debug(`State machine: SPEAKING → TOOL_EXECUTING (executing tools)`);
                } catch (error: any) {
                    this.logger.warn(`State machine transition failed: ${error.message}`);
                }

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

            // Notify completion
            if (session.onLlmCompleteCallback) {
                this.logger.info(`[TRACE] [AUDIO-FLOW-20] Calling onLlmCompleteCallback for session ${sessionId}`);
                await session.onLlmCompleteCallback(response.text, finalMessageId);
            } else {
                this.logger.error(`[TRACE] [AUDIO-FLOW-ERROR] onLlmCompleteCallback NOT DEFINED for session ${sessionId}`);
            }

            // Auto-generate title after first user-assistant exchange
            try {
                const messageCount = await ConversationMessage.countDocuments({
                    conversationId: session.conversationId
                });

                if (messageCount === 2) { // First user message + first assistant response
                    this.logger.info(`Triggering auto-title generation for conversation ${session.conversationId}`);
                    const conversationService = (await import('../conversation/conversation.service.js')).default;
                    conversationService.generateConversationTitle(session.conversationId, session.userId)
                        .catch(err => this.logger.warn(`Auto-title generation failed: ${err.message}`));
                }
            } catch (err: any) {
                this.logger.warn(`Failed to check message count for title generation: ${err.message}`);
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

                if (session.onLlmCompleteCallback) {
                    this.logger.info(`[TRACE] [GRACEFUL-DEGRADATION] Calling onLlmCompleteCallback for session ${sessionId}`);
                    await session.onLlmCompleteCallback(response.text);
                } else {
                    this.logger.error(`[TRACE] [GRACEFUL-DEGRADATION] onLlmCompleteCallback NOT DEFINED for session ${sessionId}`);
                }

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

                if (session.onLlmCompleteCallback) {
                    this.logger.info(`[TRACE] [FALLBACK-ERROR] Calling onLlmCompleteCallback for session ${sessionId}`);
                    await session.onLlmCompleteCallback(fallbackMessage);
                } else {
                    this.logger.error(`[TRACE] [FALLBACK-ERROR] onLlmCompleteCallback NOT DEFINED for session ${sessionId}`);
                }

                return { llmResponse: fallbackMessage };
            }
        }
    }

    async processTextInput(sessionId: string, textInput: string, options?: { targetMessageId?: string, skipUserPersistence?: boolean }): Promise<any> {
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
        return await this.handleFinalTranscript(sessionId, textInput, options);
    }

    async endSession(sessionId: string): Promise<boolean> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            this.logger.warn(`Attempted to end non-existent session: ${sessionId}`);
            return false;
        }

        // Stage 11: Transition to IDLE state (deactivate)
        try {
            assistantStateMachine.transition(AssistantEvent.RESET);
            this.logger.debug(`State machine: * → IDLE (session ended)`);
        } catch (error: any) {
            this.logger.warn(`State machine transition failed: ${error.message}`);
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

        // Terminate gRPC call if active
        if (session.metadata?.grpcCall) {
            try {
                session.metadata.grpcCall.end();
            } catch (e) {
                this.logger.warn(`Failed to end gRPC call: ${e}`);
            }
        }

        // Trigger summarization (async)
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

        // Stage 1: Delete from MongoDB
        try {
            await sessionPersistence.deleteSession(sessionId);
            this.logger.debug(`Session deleted from MongoDB: ${sessionId}`);
        } catch (error: any) {
            this.logger.error(`Failed to delete session from MongoDB: ${error.message}`);
        }

        this.checkpointCounters.delete(sessionId);

        return true;
    }

    async cancelStream(sessionId: string, messageId: string): Promise<boolean> {
        this.logger.info(`Cancelling stream for session ${sessionId}, messageId: ${messageId}`);
        const session = this.sessions.get(sessionId);

        // Even if session is not active in memory, we might need to check if there's an active process
        // For now, only cancel active in-memory sessions
        if (!session) {
            this.logger.warn(`Session ${sessionId} not found for cancellation`);
            return false;
        }

        // 1. Stop LLM generation if active
        const controller = this.abortControllers.get(sessionId);
        if (controller) {
            this.logger.info(`Aborting LLM generation for session ${sessionId}`);
            controller.abort();
            this.abortControllers.delete(sessionId);
        } else {
            this.logger.debug(`No active LLM controller found for session ${sessionId}`);
        }

        // 2. Stop Audio processing if active
        // This is important if user cancels while speaking or processing audio
        // TODO: Implement audio processing cancellation if supported by AudioProcessor

        // 3. Mark session as idle
        if (session.metadata?.grpcCall) {
            session.metadata.grpcCall.write({
                typing_status: {
                    status: 'idle',
                    message: undefined
                }
            });
        }

        this.logger.info(`Stream cancelled for session ${sessionId}`);
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

    /**
     * Check if transcript is valid (not noise or non-speech sounds)
     */
    private isValidTranscript(transcript: string): boolean {
        if (!transcript || transcript.trim().length === 0) {
            return false;
        }

        const normalizedTranscript = transcript.toLowerCase().trim();

        // Filter out common non-speech sounds and noise patterns
        const invalidPatterns = [
            // Parenthetical sounds
            /\(clears throat\)/i,
            /\(coughs\)/i,
            /\(laughs\)/i,
            /\(sighs\)/i,
            /\(sneezes\)/i,
            /\(yawns\)/i,
            /\(breathing\)/i,
            /\(inhales\)/i,
            /\(exhales\)/i,

            // Bracketed noise markers
            /\[blank_audio\]/i,
            /\[music\]/i,
            /\[screaming\]/i,
            /\[silence\]/i,
            /\[noise\]/i,
            /\[inaudible\]/i,
            /\[background noise\]/i,

            // Very short or repetitive patterns
            /^[a-z]{1,2}$/i,  // Single or two letters
            /^(uh+|um+|ah+|oh+|mm+|hmm+)$/i,  // Filler words only
        ];

        // Check if transcript matches any invalid pattern
        for (const pattern of invalidPatterns) {
            if (pattern.test(normalizedTranscript)) {
                return false;
            }
        }

        // Transcript must have at least one character after trimming
        if (normalizedTranscript.length === 0) {
            return false;
        }

        return true;
    }

    /**
     * Stage 1: Check if session should be checkpointed
     */
    private shouldCheckpoint(sessionId: string): boolean {
        const count = (this.checkpointCounters.get(sessionId) || 0) + 1;
        this.checkpointCounters.set(sessionId, count);

        if (count >= 10) {
            this.checkpointCounters.set(sessionId, 0);
            return true;
        }
        return false;
    }

    /**
     * Stage 1: Checkpoint session to MongoDB
     */
    private async checkpointSession(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        await sessionPersistence.checkpoint(sessionId, {
            sessionId,
            userId: session.userId,
            conversationId: session.conversationId,
            state: 'IDLE',
            lastActivity: new Date(),
            metadata: session.metadata
        });
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
