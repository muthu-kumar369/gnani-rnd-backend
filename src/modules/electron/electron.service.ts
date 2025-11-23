// src/services/electronComm.ts
import logger from '../../core/logger/logger.js';

class ElectronCommService {
    constructor() {
        logger.info('ElectronCommService initialized (placeholder).');
    }

    sendTextResponse(sessionId: string, textResponse: string): void {
        logger.info(`[ElectronComm] Sending text response to session ${sessionId}: "${textResponse}"`);
    }

    sendActionInstructions(sessionId: string | null, actionInstructions: any): void {
        logger.info(`[ElectronComm] Sending action instructions to session ${sessionId}: ${JSON.stringify(actionInstructions)}`);
    }

    sendAuditLog(sessionId: string | null, logData: any): void {
        logger.debug(`[ElectronComm] Sending audit log to session ${sessionId}: ${JSON.stringify(logData)}`);
    }

    sendAudioChunk(sessionId: string, audioChunk: Buffer, isFinal: boolean): void {
        logger.debug(`[ElectronComm] Sending audio chunk (size: ${audioChunk.length}, final: ${isFinal}) to session ${sessionId}`);
    }
}

export default new ElectronCommService();
