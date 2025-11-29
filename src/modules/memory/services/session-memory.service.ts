// src/modules/memory/services/session-memory.service.ts
import { createContextualLogger } from '../../../core/logger/logger.js';
import redisClient from '../../../config/redis.config.js';
import { Logger } from 'winston';

interface SessionState {
    userId: string;
    lastIntent?: string;
    lastAction?: any;
    isSpeaking?: boolean;
    lastActivity?: number;
    metadata?: any;
}

class SessionMemoryService {
    private logger: Logger;
    private DEFAULT_TTL: number;

    constructor() {
        this.logger = createContextualLogger({ module: 'SessionMemoryService' });
        this.DEFAULT_TTL = parseInt(process.env.MEMORY_REDIS_TTL_SECONDS || '3600', 10);
        this.logger.info(`SessionMemoryService initialized with ${this.DEFAULT_TTL}s TTL.`);
    }

    /**
     * Cache recent messages for a session
     */
    async cacheRecentMessages(
        sessionId: string,
        messages: any[],
        ttl?: number
    ): Promise<boolean> {
        try {
            const key = `session:${sessionId}:messages`;
            const value = JSON.stringify(messages);
            
            await redisClient.setex(key, ttl || this.DEFAULT_TTL, value);
            this.logger.debug(`Cached ${messages.length} messages for session ${sessionId}`);
            return true;
        } catch (error: any) {
            this.logger.error(`Error caching messages: ${error.message}`);
            return false;
        }
    }

    /**
     * Get cached messages for a session
     */
    async getCachedMessages(sessionId: string): Promise<any[] | null> {
        try {
            const key = `session:${sessionId}:messages`;
            const value = await redisClient.get(key);
            
            if (value) {
                const messages = JSON.parse(value);
                this.logger.debug(`Retrieved ${messages.length} cached messages for session ${sessionId}`);
                return messages;
            }
            
            return null;
        } catch (error: any) {
            this.logger.error(`Error getting cached messages: ${error.message}`);
            return null;
        }
    }

    /**
     * Set session state
     */
    async setSessionState(
        sessionId: string,
        state: SessionState,
        ttl?: number
    ): Promise<boolean> {
        try {
            const key = `session:${sessionId}:state`;
            const value = JSON.stringify({
                ...state,
                lastActivity: Date.now()
            });
            
            await redisClient.setex(key, ttl || this.DEFAULT_TTL, value);
            this.logger.debug(`Set session state for ${sessionId}`);
            return true;
        } catch (error: any) {
            this.logger.error(`Error setting session state: ${error.message}`);
            return false;
        }
    }

    /**
     * Get session state
     */
    async getSessionState(sessionId: string): Promise<SessionState | null> {
        try {
            const key = `session:${sessionId}:state`;
            const value = await redisClient.get(key);
            
            if (value) {
                const state = JSON.parse(value);
                this.logger.debug(`Retrieved session state for ${sessionId}`);
                return state;
            }
            
            return null;
        } catch (error: any) {
            this.logger.error(`Error getting session state: ${error.message}`);
            return null;
        }
    }

    /**
     * Update session state fields
     */
    async updateSessionState(
        sessionId: string,
        updates: Partial<SessionState>,
        ttl?: number
    ): Promise<boolean> {
        try {
            const currentState = await this.getSessionState(sessionId) || {} as SessionState;
            const newState = {
                ...currentState,
                ...updates,
                lastActivity: Date.now()
            };
            
            return await this.setSessionState(sessionId, newState, ttl);
        } catch (error: any) {
            this.logger.error(`Error updating session state: ${error.message}`);
            return false;
        }
    }

    /**
     * Clear session cache
     */
    async clearSessionCache(sessionId: string): Promise<boolean> {
        try {
            const keys = [
                `session:${sessionId}:messages`,
                `session:${sessionId}:state`
            ];
            
            await redisClient.del(...keys);
            this.logger.debug(`Cleared cache for session ${sessionId}`);
            return true;
        } catch (error: any) {
            this.logger.error(`Error clearing session cache: ${error.message}`);
            return false;
        }
    }

    /**
     * Cache user-specific data
     */
    async cacheUserData(
        userId: string,
        key: string,
        data: any,
        ttl?: number
    ): Promise<boolean> {
        try {
            const redisKey = `user:${userId}:${key}`;
            const value = JSON.stringify(data);
            
            await redisClient.setex(redisKey, ttl || this.DEFAULT_TTL, value);
            this.logger.debug(`Cached user data: ${key} for user ${userId}`);
            return true;
        } catch (error: any) {
            this.logger.error(`Error caching user data: ${error.message}`);
            return false;
        }
    }

    /**
     * Get cached user data
     */
    async getCachedUserData(userId: string, key: string): Promise<any | null> {
        try {
            const redisKey = `user:${userId}:${key}`;
            const value = await redisClient.get(redisKey);
            
            if (value) {
                return JSON.parse(value);
            }
            
            return null;
        } catch (error: any) {
            this.logger.error(`Error getting cached user data: ${error.message}`);
            return null;
        }
    }

    /**
     * Get all active session keys
     */
    async getActiveSessions(): Promise<string[]> {
        try {
            const keys = await redisClient.keys('session:*:state');
            const sessionIds = keys.map(key => {
                const match = key.match(/session:(.+):state/);
                return match ? match[1] : null;
            }).filter(id => id !== null) as string[];
            
            return sessionIds;
        } catch (error: any) {
            this.logger.error(`Error getting active sessions: ${error.message}`);
            return [];
        }
    }

    /**
     * Cleanup expired sessions
     */
    async cleanupExpiredSessions(): Promise<number> {
        try {
            const sessions = await this.getActiveSessions();
            let cleanedCount = 0;

            for (const sessionId of sessions) {
                const state = await this.getSessionState(sessionId);
                if (!state) {
                    // State expired, clean up messages too
                    await this.clearSessionCache(sessionId);
                    cleanedCount++;
                }
            }

            this.logger.info(`Cleaned up ${cleanedCount} expired sessions`);
            return cleanedCount;
        } catch (error: any) {
            this.logger.error(`Error cleaning up expired sessions: ${error.message}`);
            return 0;
        }
    }
}

export default new SessionMemoryService();
