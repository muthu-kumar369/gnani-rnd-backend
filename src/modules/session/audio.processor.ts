// src/modules/session/audio.processor.ts
import { createContextualLogger } from '../../core/logger/logger.js';
import whisperService from '../asr/whisper.service.js';
import whisperCppService from '../asr/whisper-cpp.service.js';
import FEATURE_FLAGS from '../../config/feature-flags.js';
import metrics from '../../core/monitoring/metrics.js';
import { Logger } from 'winston';

interface AudioSession {
    buffer: Buffer[];
    sampleRate: number;
}

export class AudioProcessor {
    private logger: Logger;
    private sessions: Map<string, AudioSession> = new Map();
    private MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB
    private BUFFER_WARNING_SIZE = 8 * 1024 * 1024; // 8MB

    // Month-3: Select STT service based on feature flag
    private sttService;

    constructor() {
        this.logger = createContextualLogger({ module: 'AudioProcessor' });

        // Automatic Fallback Logic
        if (FEATURE_FLAGS.USE_WHISPER_CPP) {
            if (whisperCppService.isReady()) {
                this.sttService = whisperCppService;
                this.logger.info('AudioProcessor initialized with Whisper.cpp');
            } else {
                this.sttService = whisperService;
                this.logger.warn('Whisper.cpp enabled but not ready. Falling back to Python Whisper.');
            }
        } else {
            this.sttService = whisperService;
            this.logger.info('AudioProcessor initialized with Python Whisper');
        }
    }

    async initialize(sessionId: string): Promise<void> {
        this.sessions.set(sessionId, {
            buffer: [],
            sampleRate: 16000
        });

        this.logger.debug('Audio session initialized', { sessionId });
    }

    async appendChunk(
        sessionId: string,
        chunk: Buffer,
        sampleRate: number,
        onTranscript?: (transcript: string, isFinal: boolean) => void
    ): Promise<void> {
        this.logger.info(`[LOOP_TRACE] appendChunk: sessionId=${sessionId}, size=${chunk.length}`);
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Audio session ${sessionId} not found`);
        }

        // Update sample rate if changed
        session.sampleRate = sampleRate;

        // Check buffer size BEFORE appending
        const currentSize = session.buffer.reduce((sum, buf) => sum + buf.length, 0);
        const newSize = currentSize + chunk.length;

        // Check for overflow
        if (newSize > this.MAX_BUFFER_SIZE) {
            this.logger.warn('Buffer overflow detected, flushing', {
                sessionId,
                currentSize,
                newSize
            });
            await this.flush(sessionId);
            metrics.incrementAudioBufferOverflow(sessionId);
        }

        session.buffer.push(chunk);
        metrics.setAudioBufferSize(sessionId, newSize);

        // Send to Whisper for streaming transcription
        if (onTranscript) {
            this.sttService.sendAudioChunk(sessionId, chunk, (transcript: string, isFinal: boolean) => {
                if (transcript !== 'ACK') {
                    onTranscript(transcript, isFinal);
                }
            }, false);
        }
    }

    async flush(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session || session.buffer.length === 0) return;

        session.buffer = [];
        metrics.setAudioBufferSize(sessionId, 0);
    }

    async finishStream(sessionId: string, onTranscript: (transcript: string, isFinal: boolean) => void): Promise<void> {
        this.logger.info(`[LOOP_TRACE] finishStream: sessionId=${sessionId}`);
        const session = this.sessions.get(sessionId);
        if (!session) return;

        this.logger.info('Finishing audio stream', { sessionId });

        const emptyBuffer = Buffer.alloc(0);
        session.buffer = [];
        metrics.setAudioBufferSize(sessionId, 0);

        return new Promise<void>((resolve) => {
            let resolved = false;
            const safeResolve = () => {
                if (!resolved) {
                    resolved = true;
                    resolve();
                }
            };

            const timeoutId = setTimeout(() => {
                if (!resolved) {
                    this.logger.warn('Timeout waiting for final transcription in finishStream', { sessionId });
                    safeResolve();
                }
            }, 5000);

            this.sttService.sendAudioChunk(
                sessionId,
                emptyBuffer,
                async (transcript: string, isFinal: boolean) => {
                    this.logger.info('Received final transcription from finishStream', {
                        sessionId,
                        transcript: transcript.substring(0, 100),
                        isFinal: true
                    });

                    if (onTranscript) {
                        await onTranscript(transcript, true);
                    }

                    clearTimeout(timeoutId);
                    safeResolve();
                },
                true
            );
        });
    }

    async cleanup(sessionId: string): Promise<void> {
        this.sessions.delete(sessionId);
        this.logger.debug('Audio session cleaned up', { sessionId });
        metrics.setAudioBufferSize(sessionId, 0);
    }

    getBufferStats(sessionId: string): { size: number; chunks: number } {
        const session = this.sessions.get(sessionId);
        if (!session) return { size: 0, chunks: 0 };

        const size = session.buffer.reduce((sum, buf) => sum + buf.length, 0);
        return { size, chunks: session.buffer.length };
    }
}
