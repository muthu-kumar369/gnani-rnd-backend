// src/services/whisperService.ts
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createContextualLogger } from '../utils/logger.js';
import metrics from '../utils/metrics.js';
import auditService from './auditService.js';
import { WHISPER_MODEL_PATH, WHISPER_LANGUAGE, WHISPER_SAMPLE_RATE, WHISPER_COMPUTE_TYPE, WHISPER_PYTHON_PATH } from '../configs/config.js';
import { Logger } from 'winston';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WhisperService {
    private logger: Logger;
    private pythonProcess: ChildProcessWithoutNullStreams | null = null;
    private transcriptionCallbacks: Map<string, (text: string, isFinal: boolean) => void>;

    constructor() {
        this.logger = createContextualLogger({ module: 'WhisperService' });
        this.transcriptionCallbacks = new Map();
        this.initPythonProcess();
    }

    initPythonProcess(): void {
        const pythonExecutable = WHISPER_PYTHON_PATH;
        const scriptPath = path.join(process.cwd(), 'dist', 'whisper_runner.py');

        const args = [
            scriptPath,
            '--model', WHISPER_MODEL_PATH,
            '--language', WHISPER_LANGUAGE,
            '--sample_rate', WHISPER_SAMPLE_RATE.toString(),
            '--compute_type', WHISPER_COMPUTE_TYPE,
        ];

        this.pythonProcess = spawn(pythonExecutable, args);

        this.pythonProcess.stdout.on('data', (data) => {
            const message = data.toString().trim();
            this.logger.debug(`Whisper stdout: ${message}`);
            const parts = message.split(':');
            if (parts.length === 3) {
                const sessionId = parts[0];
                const transcript = parts[1];
                const isFinal = parts[2] === 'true';
                const callback = this.transcriptionCallbacks.get(sessionId);
                if (callback) {
                    callback(transcript, isFinal);
                    auditService.logWhisperEvent(null, sessionId, message, transcript, 'info', null);
                    if (isFinal) {
                        metrics.incWhisperTranscription(sessionId, 'success');
                    }
                }
            } else if (message.startsWith('ERROR:')) {
                this.logger.error(`Whisper process error: ${message}`);
                auditService.logWhisperEvent(null, null, message, null, 'failure', message);
            }
        });

        this.pythonProcess.stderr.on('data', (data) => {
            this.logger.error(`Whisper stderr: ${data.toString()}`);
            auditService.logWhisperEvent(null, null, '', null, 'failure', data.toString());
        });

        this.pythonProcess.on('close', (code) => {
            this.logger.warn(`Whisper Python process exited with code ${code}`);
            this.pythonProcess = null;
            auditService.logWhisperEvent(null, null, '', null, 'warning', `Whisper process exited with code ${code}`);
            setTimeout(() => this.initPythonProcess(), 5000);
        });

        this.pythonProcess.on('error', (err) => {
            this.logger.error(`Failed to start Whisper Python process: ${err.message}`);
            this.pythonProcess = null;
            auditService.logWhisperEvent(null, null, '', null, 'failure', `Failed to start Whisper process: ${err.message}`);
            setTimeout(() => this.initPythonProcess(), 5000);
        });

        this.logger.info('Whisper Python process initialized.');
        auditService.logEvent('WHISPER_SERVICE_INIT', null, null, {}, 'success');
    }

    sendAudioChunk(sessionId: string, audioChunk: Buffer, onTranscription: (text: string, isFinal: boolean) => void, isLastChunk = false): void {
        if (!this.pythonProcess || !this.pythonProcess.pid) {
            this.logger.error('Whisper Python process is not running.');
            metrics.incWhisperTranscription(sessionId, 'failure');
            auditService.logWhisperEvent(null, sessionId, '', null, 'failure', 'Whisper process not running');
            return;
        }

        this.transcriptionCallbacks.set(sessionId, onTranscription);

        const header = `${sessionId}:${isLastChunk ? 'LAST' : 'CHUNK'}:`;
        this.pythonProcess.stdin.write(header);
        this.pythonProcess.stdin.write(audioChunk);
        this.pythonProcess.stdin.write('\n');
    }

    cleanupSession(sessionId: string): void {
        this.transcriptionCallbacks.delete(sessionId);
        this.logger.debug(`WhisperService cleaned up session: ${sessionId}`);
        auditService.logEvent('WHISPER_SESSION_CLEANUP', null, sessionId, {}, 'info');
    }
}

export default new WhisperService();
