// tests/integration/session-recovery.test.ts
import sessionCoordinator from '../../src/modules/session/session.coordinator.js';
import Session from '../../src/modules/session/session.model.js';
import sessionPersistence from '../../src/modules/session/session.persistence.js';

describe('Session Recovery Integration', () => {
    beforeEach(async () => {
        // Clear all sessions before each test
        await Session.deleteMany({});
    });

    afterAll(async () => {
        // Cleanup after all tests
        await Session.deleteMany({});
    });

    describe('Session Persistence and Recovery', () => {
        it('should persist session to MongoDB and recover after simulated restart', async () => {
            // Start a new session
            const { sessionId, conversationId } = await sessionCoordinator.startSession(
                'user-integration-test',
                async () => { }, // onTranscriptionCallback
                async () => { }, // onLlmChunkCallback
                async () => { }, // onLlmCompleteCallback
                async () => { }  // onToolStatusCallback
            );

            expect(sessionId).toBeTruthy();
            expect(conversationId).toBeTruthy();

            // Verify session exists in MongoDB
            const persistedSession = await sessionPersistence.loadSession(sessionId);
            expect(persistedSession).toBeTruthy();
            expect(persistedSession?.userId).toBe('user-integration-test');
            expect(persistedSession?.conversationId).toBe(conversationId);

            // Simulate backend restart by clearing in-memory sessions
            // @ts-ignore - accessing private property for testing
            sessionCoordinator['sessions'].clear();

            // Attempt to recover session
            const recovered = await sessionCoordinator.recoverSession(sessionId);

            expect(recovered).toBeTruthy();
            expect(recovered?.userId).toBe('user-integration-test');
            expect(recovered?.conversationId).toBe(conversationId);

            // Cleanup
            await sessionCoordinator.endSession(sessionId);
        });

        it('should recover from MongoDB when Redis fails', async () => {
            // Start session
            const { sessionId } = await sessionCoordinator.startSession(
                'user-mongodb-recovery',
                async () => { },
                async () => { },
                async () => { },
                async () => { }
            );

            // Clear in-memory sessions
            // @ts-ignore
            sessionCoordinator['sessions'].clear();

            // Recover (should use MongoDB since Redis might not have full state)
            const recovered = await sessionCoordinator.recoverSession(sessionId);

            expect(recovered).toBeTruthy();
            expect(recovered?.userId).toBe('user-mongodb-recovery');

            // Cleanup
            await sessionCoordinator.endSession(sessionId);
        });

        it('should handle concurrent sessions correctly', async () => {
            const userId = 'user-concurrent';

            // Start multiple sessions
            const session1 = await sessionCoordinator.startSession(
                userId,
                async () => { },
                async () => { },
                async () => { },
                async () => { }
            );

            const session2 = await sessionCoordinator.startSession(
                userId,
                async () => { },
                async () => { },
                async () => { },
                async () => { }
            );

            // Verify both sessions exist in MongoDB
            const userSessions = await sessionPersistence.getUserSessions(userId);
            expect(userSessions.length).toBeGreaterThanOrEqual(2);

            // Cleanup
            await sessionCoordinator.endSession(session1.sessionId);
            await sessionCoordinator.endSession(session2.sessionId);
        });

        it('should not recover expired sessions', async () => {
            // Create an expired session directly in MongoDB
            await sessionPersistence.saveSession({
                sessionId: 'expired-integration',
                userId: 'user-expired',
                conversationId: 'conv-expired',
                state: 'IDLE',
                audioBuffer: null,
                pendingTranscript: null,
                contextSnapshot: null,
                llmState: null,
                createdAt: new Date(),
                lastActivity: new Date(),
                expiresAt: new Date(Date.now() - 1000), // Expired
                metadata: { grpcCallActive: false, deviceInfo: null }
            });

            // Attempt to recover
            const recovered = await sessionCoordinator.recoverSession('expired-integration');

            expect(recovered).toBeNull();
        });
    });

    describe('Session Checkpointing', () => {
        it('should checkpoint session after multiple audio chunks', async () => {
            const { sessionId } = await sessionCoordinator.startSession(
                'user-checkpoint-test',
                async () => { },
                async () => { },
                async () => { },
                async () => { }
            );

            // Simulate processing 10 audio chunks (triggers checkpoint)
            const audioChunk = Buffer.from('test audio data');
            for (let i = 0; i < 10; i++) {
                await sessionCoordinator.processAudioChunk(sessionId, audioChunk, 16000);
            }

            // Verify session was checkpointed (lastCheckpoint should be recent)
            const session = await sessionPersistence.loadSession(sessionId);
            expect(session).toBeTruthy();
            expect(session?.lastCheckpoint).toBeTruthy();

            // Cleanup
            await sessionCoordinator.endSession(sessionId);
        });
    });

    describe('Session Cleanup', () => {
        it('should cleanup session on endSession', async () => {
            const { sessionId } = await sessionCoordinator.startSession(
                'user-cleanup-test',
                async () => { },
                async () => { },
                async () => { },
                async () => { }
            );

            // End session
            await sessionCoordinator.endSession(sessionId);

            // Verify session is deleted from MongoDB
            const session = await sessionPersistence.loadSession(sessionId);
            expect(session).toBeNull();
        });
    });
});
