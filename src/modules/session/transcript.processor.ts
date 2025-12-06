// src/modules/session/transcript.processor.ts
import { createContextualLogger } from '../../core/logger/logger.js';
import metrics from '../../core/monitoring/metrics.js';
import whisperService from '../asr/whisper.service.js';
import { Logger } from 'winston';

export class TranscriptProcessor {
    private logger: Logger;

    constructor() {
        this.logger = createContextualLogger({ module: 'TranscriptProcessor' });
    }

    async processAudio(sessionId: string, audioBuffer: Buffer, sampleRate: number): Promise<string> {
        try {
            // Note: In current architecture, Whisper is called streaming from AudioProcessor
            // This method is here for potential future use with batch processing
            this.logger.info('Transcript processing requested', {
                sessionId,
                bufferSize: audioBuffer.length
            });

            return ''; // Placeholder - actual transcription happens in streaming mode

        } catch (error: any) {
            this.logger.error('Transcription failed', {
                sessionId,
                error: error.message
            });
            throw error;
        }
    }

    cleanTranscript(transcript: string): string {
        // Remove non-speech sounds (safety net in case Whisper service didn't catch them)
        let cleaned = transcript;

        // Remove text in parentheses and brackets (non-speech sounds)
        cleaned = cleaned.replace(/\([^)]*\)/g, '');
        cleaned = cleaned.replace(/\[[^\]]*\]/g, '');

        // Remove extra whitespace
        cleaned = cleaned.trim().replace(/\s+/g, ' ');

        // Remove leading/trailing punctuation artifacts
        cleaned = cleaned.replace(/^[,.\s]+|[,.\s]+$/g, '');

        // Optional: Remove common filler words if needed
        // cleaned = cleaned.replace(/\b(um|uh|like)\b/gi, '');

        return cleaned;
    }
}
