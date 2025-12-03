import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import SessionMemoryService from '../../../src/modules/memory/services/session-memory.service.js';
import redisClient from '../../../src/config/redis.config.js';

// Mock Redis client
jest.mock('../../../src/config/redis.config.js', () => ({
    default: {
        setex: jest.fn(),
        get: jest.fn(),
        del: jest.fn(),
        keys: jest.fn()
    }
}));

jest.mock('../../../src/core/logger/logger.js', () => ({
    createContextualLogger: () => ({
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    })
}));

describe('SessionMemoryService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should set session state with TTL', async () => {
        const sessionId = 'test-session';
        const state = { userId: 'user1', isSpeaking: true };

        await SessionMemoryService.setSessionState(sessionId, state);

        expect(redisClient.setex).toHaveBeenCalledWith(
            `session:${sessionId}:state`,
            expect.any(Number), // TTL
            JSON.stringify({ ...state, lastActivity: expect.any(Number) })
        );
    });

    it('should get session state', async () => {
        const sessionId = 'test-session';
        const mockState = { userId: 'user1', isSpeaking: true };

        (redisClient.get as jest.Mock).mockResolvedValue(JSON.stringify(mockState));

        const state = await SessionMemoryService.getSessionState(sessionId);

        expect(redisClient.get).toHaveBeenCalledWith(`session:${sessionId}:state`);
        expect(state).toEqual(mockState);
    });

    it('should return null if session state not found', async () => {
        (redisClient.get as jest.Mock).mockResolvedValue(null);

        const state = await SessionMemoryService.getSessionState('non-existent');
        expect(state).toBeNull();
    });

    it('should clear session cache', async () => {
        const sessionId = 'test-session';

        await SessionMemoryService.clearSessionCache(sessionId);

        expect(redisClient.del).toHaveBeenCalledWith(
            `session:${sessionId}:messages`,
            `session:${sessionId}:state`
        );
    });
});
