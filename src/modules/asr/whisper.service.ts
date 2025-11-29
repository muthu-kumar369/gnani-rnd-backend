// src/services/whisperService.ts
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as child_process from 'child_process';
import fs from 'fs';
import path from 'path';
import { createContextualLogger } from '../../core/logger/logger.js';
import metrics from '../../core/monitoring/metrics.js';
import auditService from '../../core/logger/audit.service.js';
import { WHISPER_MODEL_PATH, WHISPER_LANGUAGE, WHISPER_SAMPLE_RATE, WHISPER_COMPUTE_TYPE, WHISPER_PYTHON_PATH } from '../../config/env.config.js';
import { Logger } from 'winston';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WhisperService {
    private logger: Logger;
    private pythonProcess: child_process.ChildProcess | null = null;
    private transcriptionCallbacks: Map<string, (text: string, isFinal: boolean) => void>;
    private pythonStderrLogFile: string; // Re-add this property



    constructor() {
        this.logger = createContextualLogger({ module: 'WhisperService' });
        this.transcriptionCallbacks = new Map();
        this.pythonStderrLogFile = path.join(process.cwd(), 'logs', 'whisper_python_stderr.log'); // Initialize it again


        this.initPythonProcess();
    }

    initPythonProcess(): void {
        const pythonExecutable = WHISPER_PYTHON_PATH;

        const pythonScriptPath = path.join(process.cwd(), 'scripts', 'shell', 'whisper_runner.py');

        const args = [
            pythonScriptPath,
            '--model', WHISPER_MODEL_PATH,
            '--language', WHISPER_LANGUAGE,
            '--sample_rate', WHISPER_SAMPLE_RATE.toString(),
            '--compute_type', WHISPER_COMPUTE_TYPE,
        ];

        const stderrFd = fs.openSync(this.pythonStderrLogFile, 'a');
        this.pythonProcess = spawn(pythonExecutable, args, {
            env: { ...process.env, 'VIRTUAL_ENV': path.join(process.cwd(), '.venv') },
            stdio: ['pipe', 'pipe', stderrFd] // stdin, stdout, stderr redirected to file descriptor
        });

        if (this.pythonProcess) { // Check if pythonProcess is not null
            if (this.pythonProcess.stdout) {
                this.pythonProcess.stdout.on('data', (data: Buffer) => {
                    const message = data.toString().trim();
                    this.logger.debug(`Whisper stdout: ${message}`);
                    const parts = message.split(':');
                    if (parts.length === 3) {
                        const sessionId = parts[0];
                        const transcript = parts[1];
                        const isFinal = parts[2] === 'true';

                        this.logger.debug(`Transcribed Text for session ${sessionId}: '${transcript}' (isFinal: ${isFinal})`); // Log the transcribed text

                        // If transcription is empty, log a warning
                        if (!transcript.trim()) {
                            this.logger.warn(`Empty transcription received for session ${sessionId}.`);
                            auditService.logWhisperEvent(null, sessionId, message, transcript, 'warning', 'Empty transcription');
                            
                            // CRITICAL FIX: If it's not final, we can skip. But if it IS final, we MUST call the callback
                            // to resolve the promise in finalizeSessionProcessing.
                            if (!isFinal) {
                                return;
                            }
                        }

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
            }

            this.pythonProcess.on('close', (code: number) => {
                this.logger.warn(`Whisper Python process exited with code ${code}. Check ${this.pythonStderrLogFile} for details.`);
                this.pythonProcess = null;
                auditService.logWhisperEvent(null, null, '', null, 'warning', `Whisper process exited with code ${code}`);
                setTimeout(() => this.initPythonProcess(), 5000);
            });

            this.pythonProcess.on('error', (err: Error) => {
                this.logger.error(`Failed to start Whisper Python process: ${err.message}. Check ${this.pythonStderrLogFile} for details.`);
                this.pythonProcess = null;
                auditService.logWhisperEvent(null, null, '', null, 'failure', `Failed to start Whisper process: ${err.message}`);
                setTimeout(() => this.initPythonProcess(), 5000);
            });


        } // End if (this.pythonProcess)

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

        const header = `${sessionId}:${isLastChunk ? 'LAST' : 'CHUNK'}:_`;
        const headerBuffer = Buffer.from(header, 'utf-8');
        const audioData = audioChunk; // audioChunk is already a Buffer

        this.logger.info(`Sending audio chunk to Whisper. Session: ${sessionId}, isLast: ${isLastChunk}, Raw data length: ${audioData.length}, First 50 chars: ${audioData.slice(0, 50).toString('hex')}...`);
        
        if (this.pythonProcess.stdin) {
            // Send header length as 4-byte binary integer
            const headerLengthBuffer = Buffer.alloc(4);
            headerLengthBuffer.writeUInt32BE(headerBuffer.length, 0);
            this.pythonProcess.stdin.write(headerLengthBuffer);

            // Send header data
            this.pythonProcess.stdin.write(headerBuffer);

            // Send audio data length as 4-byte binary integer
            const audioLengthBuffer = Buffer.alloc(4);
            audioLengthBuffer.writeUInt32BE(audioData.length, 0);
            this.pythonProcess.stdin.write(audioLengthBuffer);

            // Send audio data
            this.pythonProcess.stdin.write(audioData);
        } else {
            this.logger.error('Whisper Python process stdin is not available.');
            metrics.incWhisperTranscription(sessionId, 'failure');
            auditService.logWhisperEvent(null, sessionId, '', null, 'failure', 'Whisper Python process stdin not available');
            return;
        }

    }

    cleanupSession(sessionId: string): void {
        this.transcriptionCallbacks.delete(sessionId);
        this.logger.debug(`WhisperService cleaned up session: ${sessionId}`);
        auditService.logEvent('WHISPER_SESSION_CLEANUP', null, sessionId, {}, 'info');
    }
}

export default new WhisperService();
