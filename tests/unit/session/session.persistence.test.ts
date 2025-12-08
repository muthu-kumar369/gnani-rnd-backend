// tests/unit/session/session.persistence.test.ts
import sessionPersistence from '../../../src/modules/session/session.persistence.js';
import Session from '../../../src/modules/session/session.model.js';

describe('SessionPersistence', () => {
    beforeEach(async () => {
        // Clear all sessions before each test
        await Session.deleteMany({});
    });

    afterAll(async () => {
        // Cleanup after all tests
        await Session.deleteMany({});
    });

    describe('saveSession and loadSession', () => {
        it('should save and load session successfully', async () => {
            const sessionData = {
                sessionId: 'test-session-123',
                userId: 'user-456',
                conversationId: 'conv-789',
                state: 'IDLE' as const,
                audioBuffer: null,
                pendingTranscript: null,
                contextSnapshot: null,
                llmState: null,
                createdAt: new Date(),
                lastActivity: new Date(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                metadata: { grpcCallActive: false, deviceInfo: null }
            };

            await sessionPersistence.saveSession(sessionData);
            const loaded = await sessionPersistence.loadSession('test-session-123');

            expect(loaded).toBeTruthy();
            expect(loaded?.sessionId).toBe('test-session-123');
            expect(loaded?.userId).toBe('user-456');
            expect(loaded?.conversationId).toBe('conv-789');
            expect(loaded?.state).toBe('IDLE');
        });

        it('should not load expired session', async () => {
            const sessionData = {
                sessionId: 'test-expired',
                userId: 'user-456',
                conversationId: 'conv-789',
                state: 'IDLE' as const,
                audioBuffer: null,
                pendingTranscript: null,
                contextSnapshot: null,
                llmState: null,
                createdAt: new Date(),
                lastActivity: new Date(),
                expiresAt: new Date(Date.now() - 1000) // Expired 1 second ago
            };

            await sessionPersistence.saveSession(sessionData);
            const loaded = await sessionPersistence.loadSession('test-expired');

            expect(loaded).toBeNull();
        });

        it('should return null for non-existent session', async () => {
            const loaded = await sessionPersistence.loadSession('non-existent');
            expect(loaded).toBeNull();
        });
    });

    describe('checkpoint', () => {
        it('should create checkpoint if enough time has passed', async () => {
            const sessionData = {
                sessionId: 'test-checkpoint',
                userId: 'user-456',
                conversationId: 'conv-789',
                state: 'IDLE' as const,
                createdAt: new Date(),
                lastActivity: new Date(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
            };

            await sessionPersistence.saveSession(sessionData);

            // Wait a bit to simulate time passing
            await new Promise(resolve => setTimeout(resolve, 100));

            // Update checkpoint
            await sessionPersistence.checkpoint('test-checkpoint', {
                ...sessionData,
                lastActivity: new Date()
            });

            const loaded = await sessionPersistence.loadSession('test-checkpoint');
            expect(loaded).toBeTruthy();
        });
    });

    describe('deleteSession', () => {
        it('should delete session from MongoDB', async () => {
            const sessionData = {
                sessionId: 'test-delete',
                userId: 'user-456',
                conversationId: 'conv-789',
                state: 'IDLE' as const,
                createdAt: new Date(),
                lastActivity: new Date(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
            };

            await sessionPersistence.saveSession(sessionData);
            await sessionPersistence.deleteSession('test-delete');

            const loaded = await sessionPersistence.loadSession('test-delete');
            expect(loaded).toBeNull();
        });
    });

    describe('getUserSessions', () => {
        it('should return all active sessions for a user', async () => {
            const userId = 'user-multi';

            // Create multiple sessions
            await sessionPersistence.saveSession({
                sessionId: 'session-1',
                userId,
                conversationId: 'conv-1',
                state: 'IDLE' as const,
                createdAt: new Date(),
                lastActivity: new Date(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
            });

            await sessionPersistence.saveSession({
                sessionId: 'session-2',
                userId,
                conversationId: 'conv-2',
                state: 'LISTENING' as const,
                createdAt: new Date(),
                lastActivity: new Date(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
            });

            const sessions = await sessionPersistence.getUserSessions(userId);
            expect(sessions).toHaveLength(2);
            expect(sessions[0].userId).toBe(userId);
            expect(sessions[1].userId).toBe(userId);
        });

        it('should not return expired sessions', async () => {
            const userId = 'user-expired-test';

            await sessionPersistence.saveSession({
                sessionId: 'expired-session',
                userId,
                conversationId: 'conv-1',
                state: 'IDLE' as const,
                createdAt: new Date(),
                lastActivity: new Date(),
                expiresAt: new Date(Date.now() - 1000) // Expired
            });

            const sessions = await sessionPersistence.getUserSessions(userId);
            expect(sessions).toHaveLength(0);
        });
    });

    describe('cleanupExpiredSessions', () => {
        it('should cleanup expired sessions', async () => {
            // Create expired session
            await sessionPersistence.saveSession({
                sessionId: 'cleanup-test',
                userId: 'user-456',
                conversationId: 'conv-789',
                state: 'IDLE' as const,
                createdAt: new Date(),
                lastActivity: new Date(),
                expiresAt: new Date(Date.now() - 1000)
            });

            const deletedCount = await sessionPersistence.cleanupExpiredSessions();
            expect(deletedCount).toBeGreaterThan(0);

            const loaded = await sessionPersistence.loadSession('cleanup-test');
            expect(loaded).toBeNull();
        });
    });

    describe('extendSession', () => {
        it('should extend session TTL', async () => {
            const sessionData = {
                sessionId: 'extend-test',
                userId: 'user-456',
                conversationId: 'conv-789',
                state: 'IDLE' as const,
                createdAt: new Date(),
                lastActivity: new Date(),
                expiresAt: new Date(Date.now() + 1000) // Short TTL
            };

            await sessionPersistence.saveSession(sessionData);

            // Extend session
            await sessionPersistence.extendSession('extend-test');

            const loaded = await sessionPersistence.loadSession('extend-test');
            expect(loaded).toBeTruthy();
            // expiresAt should be extended (24 hours from now)
            expect(loaded!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);
        });
    });
});
