// src/services/sessionManager.ts
import { v4 as uuidv4 } from 'uuid';
import { createContextualLogger } from '../utils/logger.js';
import metrics from '../utils/metrics.js';
import auditService from './auditService.js';
import whisperService from './whisperService.js';
import audioProcessor from '../utils/audioProcessor.js';
import queryProcessor from './queryProcessor.js';
import contextEngine from './contextEngine.js';
import actionDispatcher from './actionDispatcher.js';
import llmService from './llmService.js';
import llmResponseParser from '../utils/llmResponseParser.js';
import ttsService from './ttsService.js';
import audioStreamer from '../utils/audioStreamer.js';
import { Logger } from 'winston';

interface Session {
    userId: string;
    audioBuffer: Buffer[];
    lastActivity: number;
    timeoutId: NodeJS.Timeout | null;
    onTranscriptionCallback: (transcript: string, isFinal: boolean) => void;
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

    startSession(userId: string, onTranscriptionCallback: (transcript: string, isFinal: boolean) => void): string {
        const sessionId = uuidv4();
        this.sessions.set(sessionId, {
            userId,
            audioBuffer: [],
            lastActivity: Date.now(),
            timeoutId: null,
            onTranscriptionCallback,
            metadata: {},
            currentTranscription: ''
        });
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

            const processedAudio = audioProcessor.processAudioForWhisper(audioChunk, inputSampleRate);

            session.audioBuffer.push(processedAudio);

            whisperService.sendAudioChunk(sessionId, processedAudio, (transcript: string, isFinal: boolean) => {
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
            ttsService.cleanupSession(sessionId);
            audioStreamer.cleanupSession(sessionId);
            this.logger.info(`Session ended: ${sessionId}`);
            metrics.activeSessionsGauge.inc();
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
            whisperService.sendAudioChunk(sessionId, fullAudioBuffer, (transcript: string, isFinal: boolean) => {
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

        const processedQuery = await queryProcessor.processTranscript(
            sessionId,
            session.userId,
            finalTranscription
        );

        const llmPrompt = await contextEngine.buildLLMPrompt(
            sessionId,
            session.userId,
            processedQuery
        );

        let llmResponseText = '';
        let actionDirective = null;

        this.logger.info(`Sending prompt to LLM for session ${sessionId}: ${JSON.stringify(llmPrompt)}`);
        try {
            const llmRawResponse = await llmService.getLlmResponse(llmPrompt, (partialResponse: { text: string }) => {
                if (session.onTranscriptionCallback) {
                    session.onTranscriptionCallback(partialResponse.text, false);
                }
            });
            const parsedLlmResponse = llmResponseParser.parse(llmRawResponse);
            llmResponseText = parsedLlmResponse.textResponse;
            actionDirective = parsedLlmResponse.actionInstructions;
            auditService.logLlmEvent(session.userId, sessionId, llmPrompt, llmRawResponse, 'success');
        } catch (llmError: any) {
            this.logger.error(`Error during LLM call for session ${sessionId}: ${llmError.message}`);
            auditService.logLlmEvent(session.userId, sessionId, llmPrompt, null, 'failure', llmError.message);
            llmResponseText = "I'm sorry, I encountered an error while processing your request.";
        }

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
            try {
                await ttsService.synthesizeSpeech(sessionId, llmResponseText);
            } catch (ttsError: any) {
                this.logger.error(`Error during TTS synthesis for session ${sessionId}: ${ttsError.message}`);
                auditService.logTtsEvent(session.userId, sessionId, llmResponseText, 'failure', ttsError.message);
            }
        }

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

export default new SessionManager();
