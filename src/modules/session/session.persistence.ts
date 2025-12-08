// src/modules/session/session.persistence.ts
import Session, { ISession } from './session.model.js';
import { createContextualLogger } from '../../core/logger/logger.js';
import redis from '../../config/redis.config.js';

const logger = createContextualLogger({ module: 'SessionPersistence' });

class SessionPersistence {
    private CHECKPOINT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
    private SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

    /**
     * Save complete session state to MongoDB
     */
    async saveSession(sessionData: Partial<ISession>): Promise<void> {
        try {
            const expiresAt = new Date(Date.now() + this.SESSION_TTL_MS);

            await Session.findOneAndUpdate(
                { sessionId: sessionData.sessionId },
                {
                    ...sessionData,
                    lastCheckpoint: new Date(),
                    expiresAt
                },
                { upsert: true, new: true }
            );

            logger.debug(`Session persisted to MongoDB: ${sessionData.sessionId}`);
        } catch (error: any) {
            logger.error(`Failed to persist session: ${error.message}`);
            throw error;
        }
    }

    /**
     * Load session from MongoDB
     */
    async loadSession(sessionId: string): Promise<ISession | null> {
        try {
            const session = await Session.findOne({ sessionId });

            if (!session) {
                logger.warn(`Session not found in MongoDB: ${sessionId}`);
                return null;
            }

            // Check if expired
            if (session.expiresAt < new Date()) {
                logger.warn(`Session expired: ${sessionId}`);
                await this.deleteSession(sessionId);
                return null;
            }

            logger.info(`Session loaded from MongoDB: ${sessionId}`);
            return session;
        } catch (error: any) {
            logger.error(`Failed to load session: ${error.message}`);
            return null;
        }
    }

    /**
     * Create checkpoint of current session state
     */
    async checkpoint(sessionId: string, sessionData: Partial<ISession>): Promise<void> {
        try {
            // Only checkpoint if enough time has passed
            const session = await Session.findOne({ sessionId });
            if (session) {
                const timeSinceCheckpoint = Date.now() - session.lastCheckpoint.getTime();
                if (timeSinceCheckpoint < this.CHECKPOINT_INTERVAL_MS) {
                    logger.debug(`Skipping checkpoint, too soon: ${sessionId}`);
                    return;
                }
            }

            await this.saveSession(sessionData);
            logger.info(`Checkpoint created for session: ${sessionId}`);
        } catch (error: any) {
            logger.error(`Failed to create checkpoint: ${error.message}`);
        }
    }

    /**
     * Delete session from MongoDB and Redis
     */
    async deleteSession(sessionId: string): Promise<void> {
        try {
            // Get session to cleanup audio files
            const session = await Session.findOne({ sessionId });

            // Delete from MongoDB
            await Session.deleteOne({ sessionId });

            // Delete from Redis
            await redis.del(`session:${sessionId}`);

            // TODO: Cleanup audio files from S3/local storage
            if (session?.audioBuffer?.storageUrl) {
                logger.info(`Audio file cleanup needed: ${session.audioBuffer.storageUrl}`);
                // This will be implemented in audio storage service
            }

            logger.info(`Session deleted: ${sessionId}`);
        } catch (error: any) {
            logger.error(`Failed to delete session: ${error.message}`);
        }
    }

    /**
     * Get all active sessions for a user
     */
    async getUserSessions(userId: string): Promise<ISession[]> {
        try {
            const sessions = await Session.find({
                userId,
                expiresAt: { $gt: new Date() }
            }).sort({ lastActivity: -1 });

            return sessions;
        } catch (error: any) {
            logger.error(`Failed to get user sessions: ${error.message}`);
            return [];
        }
    }

    /**
     * Cleanup expired sessions (called by cron job)
     */
    async cleanupExpiredSessions(): Promise<number> {
        try {
            // Get expired sessions for audio cleanup
            const expiredSessions = await Session.find({
                expiresAt: { $lt: new Date() }
            });

            // TODO: Cleanup audio files for expired sessions
            for (const session of expiredSessions) {
                if (session.audioBuffer?.storageUrl) {
                    logger.info(`Audio file cleanup needed: ${session.audioBuffer.storageUrl}`);
                    // This will be implemented in audio storage service
                }
            }

            // Delete expired sessions
            const result = await Session.deleteMany({
                expiresAt: { $lt: new Date() }
            });

            logger.info(`Cleaned up ${result.deletedCount} expired sessions`);
            return result.deletedCount;
        } catch (error: any) {
            logger.error(`Failed to cleanup expired sessions: ${error.message}`);
            return 0;
        }
    }

    /**
     * Extend session TTL (on user activity)
     */
    async extendSession(sessionId: string): Promise<void> {
        try {
            const expiresAt = new Date(Date.now() + this.SESSION_TTL_MS);

            await Session.findOneAndUpdate(
                { sessionId },
                {
                    lastActivity: new Date(),
                    expiresAt
                }
            );

            logger.debug(`Session TTL extended: ${sessionId}`);
        } catch (error: any) {
            logger.error(`Failed to extend session: ${error.message}`);
        }
    }
}

export default new SessionPersistence();
