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

    private restartCount: number = 0;
    private readonly MAX_RESTARTS: number = 5;

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

        // We still want to log to file, but also listen to the stream
        const stderrFd = fs.openSync(this.pythonStderrLogFile, 'a');

        this.pythonProcess = spawn(pythonExecutable, args, {
            env: { ...process.env, 'VIRTUAL_ENV': path.join(process.cwd(), '.venv') },
            stdio: ['pipe', 'pipe', 'pipe'] // Pipe stderr so we can read it
        });

        if (this.pythonProcess) {
            // Handle stdout
            if (this.pythonProcess.stdout) {
                this.pythonProcess.stdout.on('data', (data: Buffer) => {
                    const message = data.toString().trim();
                    // this.logger.debug(`Whisper stdout: ${message}`); // Too noisy

                    // Robust parsing: sessionId:transcript:isFinal
                    // Regex: ^([^:]+):(.*):(true|false)$
                    // This allows colons in the transcript
                    const match = message.match(/^([^:]+):(.*):(true|false)$/);

                    if (match) {
                        const sessionId = match[1];
                        const transcript = match[2];
                        const isFinal = match[3] === 'true';

                        this.logger.debug(`Transcribed Text for session ${sessionId}: '${transcript}' (isFinal: ${isFinal})`);

                        if (!transcript.trim()) {
                            if (!isFinal) return; // Skip empty partials
                            this.logger.warn(`Empty final transcription for session ${sessionId}.`);
                        }

                        const callback = this.transcriptionCallbacks.get(sessionId);
                        if (callback) {
                            callback(transcript, isFinal);
                            if (isFinal) {
                                metrics.incWhisperTranscription(sessionId, 'success');
                            }
                        }
                    } else if (message.startsWith('ERROR:')) {
                        this.logger.error(`Whisper process error: ${message}`);
                        auditService.logWhisperEvent(null, null, message, null, 'failure', message);
                    } else if (message === 'ACK') {
                        // Ignore ACK
                    } else {
                        // Log unexpected format but don't crash
                        // this.logger.warn(`Unexpected Whisper output format: ${message}`);
                    }
                });
            }

            // Handle stderr
            if (this.pythonProcess.stderr) {
                this.pythonProcess.stderr.on('data', (data: Buffer) => {
                    const errorMsg = data.toString();
                    // Write to log file manually since we are piping
                    fs.writeSync(stderrFd, data);

                    this.logger.error(`Whisper stderr: ${errorMsg}`);

                    // Detect critical errors
                    if (errorMsg.includes('Traceback') || errorMsg.includes('Error:')) {
                        auditService.logWhisperEvent(null, null, errorMsg, null, 'failure', 'Whisper Python Error');
                    }
                });
            }

            this.pythonProcess.on('close', (code: number) => {
                this.logger.warn(`Whisper Python process exited with code ${code}.`);
                this.pythonProcess = null;
                fs.closeSync(stderrFd);

                if (this.restartCount < this.MAX_RESTARTS) {
                    this.restartCount++;
                    const delay = 5000 * this.restartCount; // Exponential backoff
                    this.logger.info(`Restarting Whisper process in ${delay}ms (Attempt ${this.restartCount}/${this.MAX_RESTARTS})...`);
                    setTimeout(() => this.initPythonProcess(), delay);
                } else {
                    this.logger.error('Max restart attempts reached for Whisper process. Manual intervention required.');
                    auditService.logEvent('WHISPER_SERVICE_FATAL', null, null, { reason: 'Max restarts reached' }, 'failure');
                }
            });

            this.pythonProcess.on('error', (err: Error) => {
                this.logger.error(`Failed to start Whisper Python process: ${err.message}`);
                this.pythonProcess = null;
                fs.closeSync(stderrFd);
            });
        }

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
