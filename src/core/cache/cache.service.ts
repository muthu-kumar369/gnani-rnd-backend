// src/core/cache/cache.service.ts
import { redisClient } from '../../config/redis.config.js';
import { createContextualLogger } from '../logger/logger.js';
import { Logger } from 'winston';

/**
 * Centralized Redis caching service
 * Provides get, set, delete operations with error handling and logging
 */
class CacheService {
    private logger: Logger;
    private isConnected: boolean = false;

    constructor() {
        this.logger = createContextualLogger({ module: 'CacheService' });
        this.initializeConnection();
    }

    /**
     * Initialize Redis connection
     */
    private async initializeConnection(): Promise<void> {
        try {
            if (redisClient.status === 'ready') {
                this.isConnected = true;
                this.logger.info('Redis cache service initialized');
                return;
            }

            await redisClient.connect();
            this.isConnected = true;
            this.logger.info('Redis cache service connected');
        } catch (error: any) {
            this.logger.error('Failed to connect to Redis', error);
            this.isConnected = false;
        }
    }

    /**
     * Get value from cache
     * @param key Cache key
     * @returns Parsed value or null if not found
     */
    async get<T = any>(key: string): Promise<T | null> {
        if (!this.isConnected) {
            this.logger.warn('Redis not connected, skipping cache read');
            return null;
        }

        try {
            const value = await redisClient.get(key);
            if (value) {
                this.logger.debug('Cache HIT', { key });
                return JSON.parse(value) as T;
            }
            this.logger.debug('Cache MISS', { key });
            return null;
        } catch (error: any) {
            this.logger.error('Cache read error', { key, error: error.message });
            return null; // Fail gracefully
        }
    }

    /**
     * Set value in cache
     * @param key Cache key
     * @param value Value to cache (will be JSON stringified)
     * @param ttl Time to live in seconds (default: 300 = 5 minutes)
     */
    async set(key: string, value: any, ttl: number = 300): Promise<void> {
        if (!this.isConnected) {
            this.logger.warn('Redis not connected, skipping cache write');
            return;
        }

        try {
            const serialized = JSON.stringify(value);
            await redisClient.setex(key, ttl, serialized);
            this.logger.debug('Cache SET', { key, ttl });
        } catch (error: any) {
            this.logger.error('Cache write error', { key, error: error.message });
            // Don't throw - caching is optional
        }
    }

    /**
     * Delete one or more keys from cache
     * @param keys Single key or array of keys
     */
    async del(keys: string | string[]): Promise<void> {
        if (!this.isConnected) {
            this.logger.warn('Redis not connected, skipping cache delete');
            return;
        }

        try {
            const keyArray = Array.isArray(keys) ? keys : [keys];
            if (keyArray.length > 0) {
                await redisClient.del(...keyArray);
                this.logger.debug('Cache DEL', { keys: keyArray });
            }
        } catch (error: any) {
            this.logger.error('Cache delete error', { keys, error: error.message });
        }
    }

    /**
     * Delete all keys matching a pattern
     * @param pattern Pattern to match (e.g., "user:123:*")
     */
    async delPattern(pattern: string): Promise<void> {
        if (!this.isConnected) {
            this.logger.warn('Redis not connected, skipping pattern delete');
            return;
        }

        try {
            const keys = await redisClient.keys(pattern);
            if (keys.length > 0) {
                await redisClient.del(...keys);
                this.logger.debug('Cache DEL pattern', { pattern, count: keys.length });
            }
        } catch (error: any) {
            this.logger.error('Cache pattern delete error', { pattern, error: error.message });
        }
    }

    /**
     * Check if key exists in cache
     * @param key Cache key
     * @returns True if key exists
     */
    async exists(key: string): Promise<boolean> {
        if (!this.isConnected) {
            return false;
        }

        try {
            const result = await redisClient.exists(key);
            return result === 1;
        } catch (error: any) {
            this.logger.error('Cache exists check error', { key, error: error.message });
            return false;
        }
    }

    /**
     * Get TTL of a key
     * @param key Cache key
     * @returns TTL in seconds, -1 if no expiry, -2 if key doesn't exist
     */
    async ttl(key: string): Promise<number> {
        if (!this.isConnected) {
            return -2;
        }

        try {
            return await redisClient.ttl(key);
        } catch (error: any) {
            this.logger.error('Cache TTL check error', { key, error: error.message });
            return -2;
        }
    }

    /**
     * Flush all cache (use with caution!)
     */
    async flushAll(): Promise<void> {
        if (!this.isConnected) {
            this.logger.warn('Redis not connected, skipping flush');
            return;
        }

        try {
            await redisClient.flushdb();
            this.logger.warn('Cache FLUSHED - all keys deleted');
        } catch (error: any) {
            this.logger.error('Cache flush error', { error: error.message });
        }
    }

    /**
     * Get cache statistics
     */
    async getStats(): Promise<{ connected: boolean; dbSize: number }> {
        if (!this.isConnected) {
            return { connected: false, dbSize: 0 };
        }

        try {
            const dbSize = await redisClient.dbsize();
            return { connected: true, dbSize };
        } catch (error: any) {
            this.logger.error('Cache stats error', { error: error.message });
            return { connected: false, dbSize: 0 };
        }
    }
}

// Export singleton instance
export const cacheService = new CacheService();
export default cacheService;
