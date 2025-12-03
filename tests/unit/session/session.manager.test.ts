import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import SessionManager from '../../../src/modules/session/session.manager.js';
import sessionMemory from '../../../src/modules/memory/services/session-memory.service.js';
import whisperService from '../../../src/modules/asr/whisper.service.js';
import { llmManager } from '../../../src/core/llm/llm.manager.js';

// Mock dependencies
jest.mock('../../../src/modules/memory/services/session-memory.service.js');
jest.mock('../../../src/modules/asr/whisper.service.js');
jest.mock('../../../src/core/llm/llm.manager.js');
jest.mock('../../../src/core/logger/logger.js', () => ({
    createContextualLogger: () => ({
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    })
}));
jest.mock('../../../src/core/monitoring/metrics.js', () => ({
    default: {
        activeSessionsGauge: {
            set: jest.fn(),
            inc: jest.fn(),
            dec: jest.fn()
        }
    }
}));

describe('SessionManager', () => {
    // Reset mocks before each test
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should create a new session', async () => {
        const userId = 'user123';
        const sessionId = await SessionManager.startSession(
            userId,
            jest.fn(), // onTranscription
            jest.fn(), // onLlmChunk
            jest.fn()  // onToolStatus
        );

        expect(sessionId).toBeDefined();
        expect(typeof sessionId).toBe('string');

        // Verify Redis persistence was called
        expect(sessionMemory.setSessionState).toHaveBeenCalledWith(
            sessionId,
            expect.objectContaining({
                userId,
                isSpeaking: false
            })
        );
    });

    it('should get an existing session', async () => {
        const userId = 'user123';
        const sessionId = await SessionManager.startSession(userId, jest.fn());

        const session = SessionManager.getSession(sessionId);
        expect(session).toBeDefined();
        expect(session?.userId).toBe(userId);
    });

    it('should return undefined for non-existent session', () => {
        const session = SessionManager.getSession('non-existent-id');
        expect(session).toBeUndefined();
    });

    it('should append audio chunk', async () => {
        const userId = 'user123';
        const sessionId = await SessionManager.startSession(userId, jest.fn());
        const audioChunk = Buffer.from('test audio');

        await SessionManager.appendAudioChunk(sessionId, audioChunk, 16000);

        const session = SessionManager.getSession(sessionId);
        expect(session?.audioBuffer.length).toBe(1);
        expect(whisperService.sendAudioChunk).toHaveBeenCalled();
    });

    it('should end session and cleanup', async () => {
        const userId = 'user123';
        const sessionId = await SessionManager.startSession(userId, jest.fn());

        const result = SessionManager.endSession(sessionId);

        expect(result).toBe(true);
        expect(SessionManager.getSession(sessionId)).toBeUndefined();
        expect(whisperService.cleanupSession).toHaveBeenCalledWith(sessionId);
        expect(sessionMemory.clearSessionCache).toHaveBeenCalledWith(sessionId);
    });
});
