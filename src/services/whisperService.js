// src/services/whisperService.js
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createContextualLogger } = require('../utils/logger'); // Import logger factory
const metrics = require('../utils/metrics'); // Import metrics
const auditService = require('../services/auditService'); // Import audit service
const { WHISPER_MODEL_PATH, WHISPER_LANGUAGE, WHISPER_SAMPLE_RATE, WHISPER_COMPUTE_TYPE, WHISPER_PYTHON_PATH } = require('../configs/config');

class WhisperService {
    constructor() {
        this.logger = createContextualLogger({ module: 'WhisperService' }); // Create a logger instance
        this.pythonProcess = null;
        this.transcriptionCallbacks = new Map(); // Map: sessionId -> callback(text, isFinal)
        this.initPythonProcess();
    }

    /**
     * Initializes the Python Whisper child process.
     */
    initPythonProcess() {
        const pythonExecutable = WHISPER_PYTHON_PATH; // Use from config
        const scriptPath = path.join(__dirname, '../../whisper_runner.py');

        const args = [
            scriptPath,
            '--model', WHISPER_MODEL_PATH,
            '--language', WHISPER_LANGUAGE,
            '--sample_rate', WHISPER_SAMPLE_RATE.toString(), // Ensure it's a string for CLI arg
            '--compute_type', WHISPER_COMPUTE_TYPE,
        ];

        this.pythonProcess = spawn(pythonExecutable, args);

        this.pythonProcess.stdout.on('data', (data) => {
            const message = data.toString().trim();
            this.logger.debug(`Whisper stdout: ${message}`);
            // Expected format: "SESSION_ID:TRANSCRIPT:IS_FINAL"
            const parts = message.split(':');
            if (parts.length === 3) {
                const sessionId = parts[0];
                const transcript = parts[1];
                const isFinal = parts[2] === 'true';
                const callback = this.transcriptionCallbacks.get(sessionId);
                if (callback) {
                    callback(transcript, isFinal);
                    auditService.logWhisperEvent(null, sessionId, message, transcript, 'info', null); // userId is null here, will be added by auditService if needed
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
            auditService.logWhisperEvent(null, null, null, null, 'failure', data.toString());
        });

        this.pythonProcess.on('close', (code) => {
            this.logger.warn(`Whisper Python process exited with code ${code}`);
            this.pythonProcess = null;
            auditService.logWhisperEvent(null, null, null, null, 'warning', `Whisper process exited with code ${code}`);
            // Optionally, try to restart the process
            setTimeout(() => this.initPythonProcess(), 5000);
        });

        this.pythonProcess.on('error', (err) => {
            this.logger.error(`Failed to start Whisper Python process: ${err.message}`);
            this.pythonProcess = null;
            auditService.logWhisperEvent(null, null, null, null, 'failure', `Failed to start Whisper process: ${err.message}`);
            // Optionally, try to restart the process
            setTimeout(() => this.initPythonProcess(), 5000);
        });

        this.logger.info('Whisper Python process initialized.');
        auditService.logEvent('WHISPER_SERVICE_INIT', null, null, {}, 'success');
    }

    /**
     * Sends an audio chunk to the Whisper process for transcription.
     * @param {string} sessionId - The ID of the current session.
     * @param {Buffer} audioChunk - The audio data buffer.
     * @param {Function} onTranscription - Callback function (text, isFinal) for transcription results.
     * @param {boolean} isLastChunk - True if this is the last chunk for the session.
     */
    sendAudioChunk(sessionId, audioChunk, onTranscription, isLastChunk = false) {
        if (!this.pythonProcess || !this.pythonProcess.pid) {
            this.logger.error('Whisper Python process is not running.');
            metrics.incWhisperTranscription(sessionId, 'failure');
            auditService.logWhisperEvent(null, sessionId, null, null, 'failure', 'Whisper process not running');
            // Handle error: e.g., queue chunk or return an error to client
            return;
        }

        this.transcriptionCallbacks.set(sessionId, onTranscription);

        // Send audio chunk to stdin of the Python process
        // We'll need a way for the Python script to associate audio with sessionId
        // For now, let's prefix the data with sessionId and a delimiter.
        const header = `${sessionId}:${isLastChunk ? 'LAST' : 'CHUNK'}:`;
        this.pythonProcess.stdin.write(header);
        this.pythonProcess.stdin.write(audioChunk);
        this.pythonProcess.stdin.write('\n'); // Delimit chunks, or use a length prefix strategy
    }

    /**
     * Cleans up resources for a session.
     * @param {string} sessionId - The ID of the session to clean up.
     */
    cleanupSession(sessionId) {
        this.transcriptionCallbacks.delete(sessionId);
        this.logger.debug(`WhisperService cleaned up session: ${sessionId}`);
        auditService.logEvent('WHISPER_SESSION_CLEANUP', null, sessionId, {}, 'info');
    }
}

module.exports = new WhisperService();
