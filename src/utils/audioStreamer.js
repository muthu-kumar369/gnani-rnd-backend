// src/utils/audioStreamer.js
const logger = require('./logger');
const electronComm = require('../services/electronComm'); // To send audio to Electron

class AudioStreamer {
    constructor() {
        logger.info('AudioStreamer initialized.');
        this.audioQueue = new Map(); // Map: sessionId -> array of audio chunks (Buffers)
        this.isStreaming = new Map(); // Map: sessionId -> boolean (is currently streaming)
    }

    /**
     * Adds an audio chunk to the queue for a specific session and starts streaming if not already.
     * @param {string} sessionId - The ID of the session.
     * @param {Buffer} audioChunk - The audio data chunk.
     * @param {boolean} isFinal - True if this is the final chunk for the text.
     */
    addAudioChunk(sessionId, audioChunk, isFinal = false) {
        if (!this.audioQueue.has(sessionId)) {
            this.audioQueue.set(sessionId, []);
            this.isStreaming.set(sessionId, false);
        }
        this.audioQueue.get(sessionId).push({ chunk: audioChunk, isFinal });

        logger.debug(`Added audio chunk for session ${sessionId}. Queue size: ${this.audioQueue.get(sessionId).length}`);

        if (!this.isStreaming.get(sessionId)) {
            this._processQueue(sessionId);
        }
    }

    /**
     * Internal method to process the audio queue for a session.
     * Sends chunks to Electron one by one.
     * @param {string} sessionId - The ID of the session.
     */
    async _processQueue(sessionId) {
        this.isStreaming.set(sessionId, true);

        const queue = this.audioQueue.get(sessionId);
        while (queue && queue.length > 0) {
            const { chunk, isFinal } = queue.shift();
            // Send to Electron
            electronComm.sendAudioChunk(sessionId, chunk, isFinal);
            logger.debug(`Sent audio chunk from queue for session ${sessionId}. Remaining: ${queue.length}`);
            
            // Introduce a small delay to simulate real-time streaming and prevent overwhelming Electron
            await new Promise(resolve => setTimeout(resolve, 50)); // Adjust delay as needed
        }
        this.isStreaming.set(sessionId, false);
        logger.info(`Audio streaming finished for session ${sessionId}.`);
    }

    /**
     * Cleans up the audio queue and streaming state for a session.
     * @param {string} sessionId - The ID of the session.
     */
    cleanupSession(sessionId) {
        this.audioQueue.delete(sessionId);
        this.isStreaming.delete(sessionId);
        logger.debug(`AudioStreamer cleaned up session: ${sessionId}`);
    }

    /**
     * Placeholder method for electronComm to actually send audio chunks.
     * This method will be integrated into electronComm.js.
     * @param {string} sessionId - The ID of the session.
     * @param {Buffer} audioChunk - The audio data chunk.
     * @param {boolean} isFinal - True if this is the final chunk.
     */
    sendAudioChunkToElectron(sessionId, audioChunk, isFinal) {
        logger.warn(`[ElectronComm Placeholder] Sending audio chunk to Electron for session ${sessionId}, size: ${audioChunk.length}, isFinal: ${isFinal}`);
        // This is a placeholder for the actual electronComm.sendAudioChunk method
    }
}

module.exports = new AudioStreamer();
