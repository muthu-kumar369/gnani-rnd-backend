// src/services/sessionManager.js
const { v4: uuidv4 } = require('uuid');
const { createContextualLogger } = require('../utils/logger'); // Import logger factory
const metrics = require('../utils/metrics'); // Import metrics
const auditService = require('../services/auditService'); // Import audit service
const whisperService = require('./whisperService'); // Import Whisper service
const audioProcessor = require('../utils/audioProcessor'); // Import Audio Processor
const queryProcessor = require('./queryProcessor'); // Import Query Processor
const contextEngine = require('./contextEngine'); // Import Context Engine
const actionDispatcher = require('./actionDispatcher'); // Import Action Dispatcher
const llmService = require('./llmService'); // Import LLM Service
const llmResponseParser = require('../utils/llmResponseParser'); // Import LLM Response Parser
const ttsService = require('./ttsService'); // Import TTS Service
const audioStreamer = require('../utils/audioStreamer'); // Import Audio Streamer

class SessionManager {
    constructor() {
        this.logger = createContextualLogger({ module: 'SessionManager' }); // Create a logger instance
        this.sessions = new Map(); // Map: sessionId -> { userId, audioBuffer, lastActivity, timeoutId, onTranscriptionCallback, metadata }
        this.SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
        setInterval(this.cleanupInactiveSessions.bind(this), 60 * 1000); // Check every minute
        this.logger.info('SessionManager initialized.');
        metrics.activeSessionsGauge.set(0); // Initialize active sessions metric
    }

    /**
     * Starts a new session.
     * @param {string} userId - The ID of the user starting the session.
     * @param {Function} onTranscriptionCallback - Callback for sending transcription updates to gRPC stream.
     * @returns {string} The new sessionId.
     */
    startSession(userId, onTranscriptionCallback) {
        const sessionId = uuidv4();
        this.sessions.set(sessionId, {
            userId,
            audioBuffer: [], // Array of audio chunks
            lastActivity: Date.now(),
            timeoutId: null,
            onTranscriptionCallback, // Store the callback for this session
            metadata: {}, // For any additional session-specific data
            currentTranscription: '' // To hold the latest transcription for the session
        });
        this.resetSessionTimeout(sessionId);
        this.logger.info(`Session started: ${sessionId} for user ${userId}`);
        metrics.activeSessionsGauge.inc();
        auditService.logEvent('SESSION_START', userId, sessionId, {}, 'success');
        return sessionId;
    }

    /**
     * Retrieves session data.
     * @param {string} sessionId - The ID of the session.
     * @returns {Object|null} Session data or null if not found.
     */
    getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            this.resetSessionTimeout(sessionId);
        }
        return session;
    }

    /**
     * Appends an audio chunk to the session's buffer and sends for transcription.
     * @param {string} sessionId - The ID of the session.
     * @param {Buffer} audioChunk - The raw audio data chunk.
     * @param {number} inputSampleRate - The sample rate of the input audio.
     */
    async appendAudioChunk(sessionId, audioChunk, inputSampleRate) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastActivity = Date.now();
            this.resetSessionTimeout(sessionId);

            const processedAudio = audioProcessor.processAudioForWhisper(audioChunk, inputSampleRate);

            // Add to session buffer if needed for final processing, or if Whisper requires full audio
            session.audioBuffer.push(processedAudio);

            // Send to Whisper for real-time transcription
            whisperService.sendAudioChunk(sessionId, processedAudio, (transcript, isFinal) => {
                session.currentTranscription = transcript;
                if (session.onTranscriptionCallback) {
                    session.onTranscriptionCallback(transcript, isFinal);
                }
            }, false); // Not the last chunk
            this.logger.debug(`Appended audio chunk to session ${sessionId}. Buffer size: ${session.audioBuffer.length}`);
        } else {
            this.logger.warn(`Attempted to append audio to non-existent session: ${sessionId}`);
            auditService.logEvent('AUDIO_CHUNK_APPEND', null, sessionId, { reason: 'Session not found' }, 'failure');
        }
    }

    /**
     * Clears the audio buffer for a session.
     * @param {string} sessionId - The ID of the session.
     */
    clearAudioBuffer(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.audioBuffer = [];
            this.logger.debug(`Audio buffer cleared for session: ${sessionId}`);
        }
    }

    /**
     * Ends and cleans up a session.
     * @param {string} sessionId - The ID of the session.
     * @returns {boolean} True if session was found and ended, false otherwise.
     */
    endSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            clearTimeout(session.timeoutId);
            this.sessions.delete(sessionId);
            whisperService.cleanupSession(sessionId); // Clean up WhisperService resources
            queryProcessor.clearSessionMemory(sessionId); // Also clean up queryProcessor session memory
            ttsService.cleanupSession(sessionId); // Clean up TTS Service resources
            audioStreamer.cleanupSession(sessionId); // Clean up AudioStreamer resources
            this.logger.info(`Session ended: ${sessionId}`);
            metrics.activeSessionsGauge.dec();
            auditService.logEvent('SESSION_END', session.userId, sessionId, {}, 'success');
            return true;
        }
        this.logger.warn(`Attempted to end non-existent session: ${sessionId}`);
        auditService.logEvent('SESSION_END', null, sessionId, { reason: 'Session not found' }, 'failure');
        return false;
    }

    /**
     * Resets the timeout for a given session.
     * @param {string} sessionId - The ID of the session.
     */
    resetSessionTimeout(sessionId) {
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

    /**
     * Periodically cleans up inactive sessions.
     */
    cleanupInactiveSessions() {
        const now = Date.now();
        for (const [sessionId, session] of this.sessions.entries()) {
            if (now - session.lastActivity > this.SESSION_TIMEOUT_MS) {
                this.logger.warn(`Inactive session ${sessionId} detected. Cleaning up.`);
                auditService.logEvent('SESSION_INACTIVE_CLEANUP', session.userId, sessionId, {}, 'warning');
                this.endSession(sessionId);
            }
        }
    }

    /**
     * Sends the final audio chunk to Whisper for final transcription, then processes the query.
     * @param {string} sessionId - The ID of the session.
     * @returns {Object} Processed query object (cleanedText, intent, llmResponse, actionDirective).
     */
    async finalizeSessionProcessing(sessionId) {
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
        
        // Wait for final transcription from Whisper
        await new Promise(resolve => {
            whisperService.sendAudioChunk(sessionId, fullAudioBuffer, (transcript, isFinal) => {
                session.currentTranscription = transcript;
                if (isFinal) { // Only resolve promise on final transcript
                    if (session.onTranscriptionCallback) {
                        // Send partial update, but the final response will contain more details
                        session.onTranscriptionCallback(transcript, isFinal);
                    }
                    resolve();
                }
            }, true); // This is the last chunk
        });

        const finalTranscription = session.currentTranscription;
        this.clearAudioBuffer(sessionId); // Clear buffer after processing

        // 1. Process the final transcript using QueryProcessor
        const processedQuery = await queryProcessor.processTranscript(
            sessionId,
            session.userId,
            finalTranscription
        );

        // 2. Build the LLM prompt using ContextEngine
        const llmPrompt = await contextEngine.buildLLMPrompt(
            sessionId,
            session.userId,
            processedQuery
        );

        let llmResponseText = '';
        let actionDirective = null;

        // 3. LLM execution (Stage 7)
        this.logger.info(`Sending prompt to LLM for session ${sessionId}: ${JSON.stringify(llmPrompt)}`);
        try {
            const llmRawResponse = await llmService.getLlmResponse(llmPrompt, (partialResponse) => {
                // Handle streaming if enabled and onPartialResponse callback exists
                if (session.onTranscriptionCallback) {
                    session.onTranscriptionCallback(partialResponse.text, false); // Send partial LLM response
                }
            });
            const parsedLlmResponse = llmResponseParser.parse(llmRawResponse);
            llmResponseText = parsedLlmResponse.textResponse;
            actionDirective = parsedLlmResponse.actionInstructions;
            auditService.logLlmEvent(session.userId, sessionId, llmPrompt, llmRawResponse, 'success');
        } catch (llmError) {
            this.logger.error(`Error during LLM call for session ${sessionId}: ${llmError.message}`);
            auditService.logLlmEvent(session.userId, sessionId, llmPrompt, null, 'failure', llmError.message);
            llmResponseText = "I'm sorry, I encountered an error while processing your request.";
        }

        // 4. Dispatch action if identified and authorized
        if (actionDirective && actionDirective.action) { // Ensure actionDirective is valid
            this.logger.info(`Attempting to dispatch action for session ${sessionId}: ${JSON.stringify(actionDirective)}`);
            const actionResult = await actionDispatcher.dispatch(session.userId, actionDirective, sessionId); // Pass sessionId
            if (actionResult.success) {
                this.logger.info(`Action dispatched successfully for session ${sessionId}: ${actionResult.message}`);
                llmResponseText += ` (Action executed: ${actionResult.message})`;
            } else {
                this.logger.warn(`Action dispatch failed for session ${sessionId}: ${actionResult.message}`);
                llmResponseText += ` (Action failed: ${actionResult.message})`;
                actionDirective = null; // Clear action if it failed
            }
        } else {
             this.logger.info(`No action to dispatch for session ${sessionId}.`);
        }
        
        // 5. TTS processing and streaming to Electron
        if (llmResponseText) {
            try {
                await ttsService.synthesizeSpeech(sessionId, llmResponseText);
                // audioStreamer will pick up chunks from ttsService.ttsOutputBuffers
                // and send them to Electron.
            } catch (ttsError) {
                this.logger.error(`Error during TTS synthesis for session ${sessionId}: ${ttsError.message}`);
                auditService.logTtsEvent(session.userId, sessionId, llmResponseText, 'failure', ttsError.message);
            }
        }

        // Add interaction to session memory
        queryProcessor.addInteractionToMemory(sessionId, processedQuery.cleanedText, llmResponseText);

        auditService.logEvent('SESSION_FINALIZE', session.userId, sessionId, { finalTranscription, llmResponseText, actionDirective }, 'success');

        return {
            cleanedText: processedQuery.cleanedText,
            intent: processedQuery.intent,
            llmResponse: llmResponseText,
            actionDirective: actionDirective,
            cacheHit: processedQuery.cacheHit
        };
    }
}

module.exports = new SessionManager();