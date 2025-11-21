// src/services/auditService.ts
import logger, { createContextualLogger } from '../utils/logger.js';
import electronComm from './electronComm.js';

class AuditService {
    logEvent(eventType: string, userId: string | null, sessionId: string | null = null, data: object = {}, status: 'success' | 'failure' | 'denied' | 'info' | 'warning' = 'info'): void {
        const contextualLogger = createContextualLogger({ userId, sessionId, eventType });
        const auditLog = {
            eventType,
            userId,
            sessionId,
            timestamp: new Date().toISOString(),
            status,
            ...data
        };

        switch (status) {
            case 'success':
            case 'info':
                contextualLogger.info(eventType, auditLog);
                break;
            case 'warning':
                contextualLogger.warn(eventType, auditLog);
                break;
            case 'failure':
            case 'denied':
                contextualLogger.error(eventType, auditLog);
                break;
            default:
                contextualLogger.info(eventType, auditLog);
        }

        electronComm.sendAuditLog(sessionId, auditLog);
    }

    logAuthEvent(userId: string | null, eventType: string, status: 'success' | 'failure', data: object = {}, sessionId: string | null = null): void {
        this.logEvent(`AUTH_${eventType.toUpperCase()}`, userId, sessionId, data, status);
    }

    logActionDispatch(userId: string, sessionId: string | null, actionObject: any, status: 'success' | 'failure' | 'denied' | 'error', result: any = null): void {
        this.logEvent('ACTION_DISPATCH', userId, sessionId, { action: actionObject.action, params: actionObject, result }, status as any);
    }

    logLlmEvent(userId: string, sessionId: string, prompt: any, response: any, status: 'success' | 'failure' | 'info', error: string | null = null): void {
        this.logEvent('LLM_INTERACTION', userId, sessionId, { prompt: prompt, response: response, error: error }, status);
    }

    logTtsEvent(userId: string | null, sessionId: string | null, text: string, status: 'success' | 'failure' | 'warning', error: string | null = null): void {
        this.logEvent('TTS_SYNTHESIS', userId, sessionId, { text: text.substring(0, 100) + '...', error: error }, status);
    }

    logWhisperEvent(userId: string | null, sessionId: string | null, rawTranscript: string, finalTranscript: string | null, status: 'success' | 'failure' | 'info' | 'warning', error: string | null = null): void {
        this.logEvent('WHISPER_TRANSCRIPTION', userId, sessionId, { rawTranscript, finalTranscript, error }, status);
    }

    logDbEvent(userId: string, sessionId: string, dbType: string, operation: string, status: 'success' | 'failure', details: object = {}, error: string | null = null): void {
        this.logEvent('DB_INTERACTION', userId, sessionId, { dbType, operation, details, error }, status);
    }
}

export default new AuditService();
