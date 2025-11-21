// src/services/ttsService.js
const { spawn } = require('child_process');
const path = require('path');
const { createContextualLogger } = require('../utils/logger'); // Import logger factory
const metrics = require('../utils/metrics'); // Import metrics
const auditService = require('../services/auditService'); // Import audit service
const {
    TTS_PYTHON_PATH,
    TTS_ENGINE,
    TTS_VOICE,
    TTS_LANGUAGE,
    TTS_SAMPLE_RATE,
    TTS_STREAM_CHUNK_SIZE
} = require('../configs/config');

class TtsService {

    constructor() {

        this.logger = createContextualLogger({ module: 'TtsService' }); // Create a logger instance

        this.pythonProcess = null;

        this.ttsOutputBuffers = new Map(); // Map: sessionId -> array of audio chunks

        this.initPythonProcess();

    }



    /**

     * Initializes the Python TTS child process.

     */

    initPythonProcess() {

        const pythonExecutable = TTS_PYTHON_PATH;

        const scriptPath = path.join(__dirname, '../../tts_runner.py'); // Relative to project root



        const args = [

            scriptPath,

            '--engine', TTS_ENGINE,

            '--voice', TTS_VOICE,

            '--language', TTS_LANGUAGE,

            '--sample_rate', TTS_SAMPLE_RATE.toString(),

            '--chunk_size', TTS_STREAM_CHUNK_SIZE.toString(),

        ];



        this.pythonProcess = spawn(pythonExecutable, args);



        this.pythonProcess.stdout.on('data', (data) => {

            // Assuming Python script sends Base64 encoded audio chunks

            const message = data.toString().trim();

            if (message.startsWith('AUDIO:')) {

                const parts = message.substring(6).split(':', 2);

                if (parts.length === 2) {

                    const sessionId = parts[0];

                    const audioBase64 = parts[1];

                    const audioChunk = Buffer.from(audioBase64, 'base64');

                    // Store the chunk, a downstream service will pick it up

                    if (!this.ttsOutputBuffers.has(sessionId)) {

                        this.ttsOutputBuffers.set(sessionId, []);

                    }

                    this.ttsOutputBuffers.get(sessionId).push(audioChunk);

                    this.logger.debug(`Received TTS audio chunk for session ${sessionId}, size: ${audioChunk.length}`);

                }

            } else if (message.startsWith('END:')) {

                const sessionId = message.substring(4);

                // Signal end of stream for this session

                this.logger.debug(`TTS stream ended for session ${sessionId}`);

                // The audioStreamer will know to stop when it tries to get a chunk and finds none

                // after the last one was returned.

            } else if (message.startsWith('ERROR:')) {

                this.logger.error(`TTS Python process error: ${message}`);

                auditService.logTtsEvent(null, null, null, 'failure', message);

            } else {

                this.logger.debug(`TTS stdout: ${message}`); // For other informational messages

            }

        });



        this.pythonProcess.stderr.on('data', (data) => {

            this.logger.error(`TTS stderr: ${data.toString()}`);

            auditService.logTtsEvent(null, null, null, 'failure', data.toString());

        });



        this.pythonProcess.on('close', (code) => {

            this.logger.warn(`TTS Python process exited with code ${code}`);

            this.pythonProcess = null;

            auditService.logTtsEvent(null, null, null, 'warning', `TTS process exited with code ${code}`);

            setTimeout(() => this.initPythonProcess(), 5000);

        });



        this.pythonProcess.on('error', (err) => {

            this.logger.error(`Failed to start TTS Python process: ${err.message}`);

            this.pythonProcess = null;

            auditService.logTtsEvent(null, null, null, 'failure', `Failed to start TTS process: ${err.message}`);

            setTimeout(() => this.initPythonProcess(), 5000);

        });



        this.logger.info('TTS Python process initialized.');

        auditService.logEvent('TTS_SERVICE_INIT', null, null, {}, 'success');

    }

    /**
     * Converts text to speech and makes it available as audio chunks.
     * @param {string} sessionId - The ID of the current session.
     * @param {string} text - The text to synthesize.
     * @returns {Promise<void>} Resolves when the text has been sent to the TTS process.
     */
    async synthesizeSpeech(sessionId, text) {
        if (!this.pythonProcess || !this.pythonProcess.pid) {
            this.logger.error('TTS Python process is not running.');
            metrics.incTtsSynthesis(sessionId, TTS_LANGUAGE, TTS_VOICE, 'failure');
            auditService.logTtsEvent(null, sessionId, text, 'failure', 'TTS process not running');
            throw new Error('TTS service unavailable.');
        }

        const message = `TEXT:${sessionId}:${text}\n`;
        this.pythonProcess.stdin.write(message);
        this.logger.debug(`Sent text to TTS process for session ${sessionId}: "${text.substring(0, 50)}"...`);
        metrics.incTtsSynthesis(sessionId, TTS_LANGUAGE, TTS_VOICE, 'success');
        auditService.logTtsEvent(null, sessionId, text, 'success');
    }

    /**
     * Retrieves the next available audio chunk for a session.
     * @param {string} sessionId - The ID of the session.
     * @returns {Buffer|null} The next audio chunk, or null if no chunks are available.
     */
    getNextAudioChunk(sessionId) {
        if (this.ttsOutputBuffers.has(sessionId)) {
            const buffer = this.ttsOutputBuffers.get(sessionId);
            if (buffer.length > 0) {
                return buffer.shift();
            }
        }
        return null;
    }

    /**
     * Cleans up resources for a session.
     * @param {string} sessionId - The ID of the session to clean up.
     */
    cleanupSession(sessionId) {
        if (this.ttsOutputBuffers.has(sessionId)) {
            this.ttsOutputBuffers.delete(sessionId);
            this.logger.debug(`TtsService cleaned up session: ${sessionId}`);
            auditService.logEvent('TTS_SESSION_CLEANUP', null, sessionId, {}, 'info');
        }
    }
}

module.exports = new TtsService();