// src/utils/audioStreamer.ts
import logger from '../core/logger/logger.js';
import electronComm from '../modules/electron/electron.service.js';

interface AudioQueueItem {
    chunk: Buffer;
    isFinal: boolean;
}

class AudioStreamer {
    private audioQueue: Map<string, AudioQueueItem[]>;
    private isStreaming: Map<string, boolean>;

    constructor() {
        logger.info('AudioStreamer initialized.');
        this.audioQueue = new Map();
        this.isStreaming = new Map();
    }

    addAudioChunk(sessionId: string, audioChunk: Buffer, isFinal = false): void {
        if (!this.audioQueue.has(sessionId)) {
            this.audioQueue.set(sessionId, []);
            this.isStreaming.set(sessionId, false);
        }
        this.audioQueue.get(sessionId)!.push({ chunk: audioChunk, isFinal });

        logger.debug(`Added audio chunk for session ${sessionId}. Queue size: ${this.audioQueue.get(sessionId)!.length}`);

        if (!this.isStreaming.get(sessionId)) {
            this._processQueue(sessionId);
        }
    }

    private async _processQueue(sessionId: string): Promise<void> {
        this.isStreaming.set(sessionId, true);

        const queue = this.audioQueue.get(sessionId);
        while (queue && queue.length > 0) {
            const { chunk, isFinal } = queue.shift()!;
            electronComm.sendAudioChunk(sessionId, chunk, isFinal);
            logger.debug(`Sent audio chunk from queue for session ${sessionId}. Remaining: ${queue.length}`);
            
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        this.isStreaming.set(sessionId, false);
        logger.info(`Audio streaming finished for session ${sessionId}.`);
    }

    cleanupSession(sessionId: string): void {
        this.audioQueue.delete(sessionId);
        this.isStreaming.delete(sessionId);
        logger.debug(`AudioStreamer cleaned up session: ${sessionId}`);
    }

    sendAudioChunkToElectron(sessionId: string, audioChunk: Buffer, isFinal: boolean): void {
        logger.warn(`[ElectronComm Placeholder] Sending audio chunk to Electron for session ${sessionId}, size: ${audioChunk.length}, isFinal: ${isFinal}`);
    }
}

export default new AudioStreamer();
