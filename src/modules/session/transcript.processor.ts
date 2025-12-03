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
        // Remove extra whitespace
        let cleaned = transcript.trim().replace(/\s+/g, ' ');
        
        // Remove common filler words if needed (optional)
        // cleaned = cleaned.replace(/\b(um|uh|like)\b/gi, '');
        
        return cleaned;
    }
}
