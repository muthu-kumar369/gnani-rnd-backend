// src/services/auditService.js
const { createContextualLogger, logger: baseLogger } = require('../utils/logger'); // Import logger factory
const electronComm = require('./electronComm'); // For sending audit logs to Electron

class AuditService {
    /**
     * Logs an audit event.
     * @param {string} eventType - The type of event (e.g., 'USER_LOGIN', 'ACTION_DISPATCHED', 'TTS_SYNTHESIS').
     * @param {string} userId - The ID of the user associated with the event.
     * @param {string} [sessionId] - The ID of the session associated with the event.
     * @param {Object} data - Additional data related to the event.
     * @param {string} status - Status of the event ('success', 'failure', 'denied', 'info', 'warning').
     */
    logEvent(eventType, userId, sessionId = null, data = {}, status = 'info') {
        const contextualLogger = createContextualLogger({ userId, sessionId, eventType });
        const auditLog = {
            eventType,
            userId,
            sessionId,
            timestamp: new Date().toISOString(),
            status,
            ...data
        };

        // Log to file/console using the contextual logger
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

        // Also send to Electron for real-time monitoring/display in UI
        electronComm.sendAuditLog(sessionId, auditLog);
    }

    /**
     * Helper to log authentication events.
     */
    logAuthEvent(userId, eventType, status, data = {}, sessionId = null) {
        this.logEvent(`AUTH_${eventType.toUpperCase()}`, userId, sessionId, data, status);
    }

    /**
     * Helper to log action dispatch events.
     */
    logActionDispatch(userId, sessionId, actionObject, status, result = null) {
        this.logEvent('ACTION_DISPATCH', userId, sessionId, { action: actionObject.action, params: actionObject, result }, status);
    }

    /**
     * Helper to log LLM interaction events.
     */
    logLlmEvent(userId, sessionId, prompt, response, status, error = null) {
        this.logEvent('LLM_INTERACTION', userId, sessionId, { prompt: prompt, response: response, error: error }, status);
    }

    /**
     * Helper to log TTS synthesis events.
     */
    logTtsEvent(userId, sessionId, text, status, error = null) {
        this.logEvent('TTS_SYNTHESIS', userId, sessionId, { text: text.substring(0, 100) + '...', error: error }, status);
    }

    /**
     * Helper to log Whisper transcription events.
     */
    logWhisperEvent(userId, sessionId, rawTranscript, finalTranscript, status, error = null) {
        this.logEvent('WHISPER_TRANSCRIPTION', userId, sessionId, { rawTranscript, finalTranscript, error }, status);
    }

    /**
     * Helper to log database interactions (MongoDB or Vector DB).
     */
    logDbEvent(userId, sessionId, dbType, operation, status, details = {}, error = null) {
        this.logEvent('DB_INTERACTION', userId, sessionId, { dbType, operation, details, error }, status);
    }
}

module.exports = new AuditService();
