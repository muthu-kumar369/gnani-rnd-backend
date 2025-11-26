// src/services/ttsService.ts
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';
import { createContextualLogger } from '../../core/logger/logger.js';
import metrics from '../../core/monitoring/metrics.js';
import auditService from '../../core/logger/audit.service.js';
import {
    TTS_PYTHON_PATH,
    TTS_ENGINE,
    TTS_VOICE,
    TTS_LANGUAGE,
    TTS_SAMPLE_RATE,
    TTS_STREAM_CHUNK_SIZE
} from '../../config/env.config.js';
import { Logger } from 'winston';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TtsService {
    private logger: Logger;
    private pythonProcess: ChildProcessWithoutNullStreams | null = null;
    public ttsOutputBuffers: Map<string, Buffer[]>;

    constructor() {
        this.logger = createContextualLogger({ module: 'TtsService' });
        this.ttsOutputBuffers = new Map();
        this.ttsOutputBuffers = new Map();
        // this.initPythonProcess(); // TTS disabled
    }

    initPythonProcess(): void {
        const pythonExecutable = TTS_PYTHON_PATH;
        const scriptPath = path.join(process.cwd(), 'dist', 'tts_runner.py');

        const args = [
            scriptPath,
            '--engine', TTS_ENGINE,
            '--voice', TTS_VOICE,
            // Removed --language as the model might not be multi-lingual
            '--sample_rate', TTS_SAMPLE_RATE.toString(),
            '--chunk_size', TTS_STREAM_CHUNK_SIZE.toString(),
        ];

        this.pythonProcess = spawn(pythonExecutable, args);

        this.pythonProcess.stdout.on('data', (data) => {
            const message = data.toString().trim();
            if (message.startsWith('AUDIO:')) {
                const parts = message.substring(6).split(':', 2);
                if (parts.length === 2) {
                    const sessionId = parts[0];
                    const audioBase64 = parts[1];
                    const audioChunk = Buffer.from(audioBase64, 'base64');
                    if (!this.ttsOutputBuffers.has(sessionId)) {
                        this.ttsOutputBuffers.set(sessionId, []);
                    }
                    this.ttsOutputBuffers.get(sessionId)!.push(audioChunk);
                    this.logger.debug(`Received TTS audio chunk for session ${sessionId}, size: ${audioChunk.length}`);
                }
            } else if (message.startsWith('END:')) {
                const sessionId = message.substring(4);
                this.logger.debug(`TTS stream ended for session ${sessionId}`);
            } else if (message.startsWith('ERROR:')) {
                this.logger.error(`TTS Python process error: ${message}`);
                auditService.logTtsEvent(null, null, '', 'failure', message);
            } else {
                this.logger.debug(`TTS stdout: ${message}`);
            }
        });

        this.pythonProcess.stderr.on('data', (data) => {
            this.logger.error(`TTS stderr: ${data.toString()}`);
            auditService.logTtsEvent(null, null, '', 'failure', data.toString());
        });

        this.pythonProcess.on('close', (code) => {
            this.logger.warn(`TTS Python process exited with code ${code}`);
            this.pythonProcess = null;
            auditService.logTtsEvent(null, null, '', 'warning', `TTS process exited with code ${code}`);
            setTimeout(() => this.initPythonProcess(), 5000);
        });

        this.pythonProcess.on('error', (err) => {
            this.logger.error(`Failed to start TTS Python process: ${err.message}`);
            this.pythonProcess = null;
            auditService.logTtsEvent(null, null, '', 'failure', `Failed to start TTS process: ${err.message}`);
            setTimeout(() => this.initPythonProcess(), 5000);
        });

        this.logger.info('TTS Python process initialized.');
        auditService.logEvent('TTS_SERVICE_INIT', null, null, {}, 'success');
    }

    async synthesizeSpeech(sessionId: string, text: string): Promise<void> {
        // TTS disabled. Text is streamed directly.
        this.logger.info(`TTS skipped for session ${sessionId}. Text: "${text.substring(0, 50)}..."`);
        metrics.incTtsSynthesis(sessionId, TTS_LANGUAGE, TTS_VOICE, 'skipped');
        auditService.logTtsEvent(null, sessionId, text, 'success', 'TTS skipped (text streaming enabled)');
    }

    getNextAudioChunk(sessionId: string): Buffer | null {
        if (this.ttsOutputBuffers.has(sessionId)) {
            const buffer = this.ttsOutputBuffers.get(sessionId)!;
            if (buffer.length > 0) {
                return buffer.shift()!;
            }
        }
        return null;
    }

    cleanupSession(sessionId: string): void {
        if (this.ttsOutputBuffers.has(sessionId)) {
            this.ttsOutputBuffers.delete(sessionId);
            this.logger.debug(`TtsService cleaned up session: ${sessionId}`);
            auditService.logEvent('TTS_SESSION_CLEANUP', null, sessionId, {}, 'info');
        }
    }
}

export default new TtsService();
