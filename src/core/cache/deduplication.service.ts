import { createContextualLogger } from '../logger/logger.js';
import redisClient from '../../config/redis.config.js';
import crypto from 'crypto';

export interface DedupRequest {
    key: string;
    promise: Promise<any>;
    timestamp: number;
}

export class DeduplicationService {
    private readonly logger = createContextualLogger({ module: 'Deduplication' });
    private inFlightRequests: Map<string, DedupRequest> = new Map();
    private readonly ttl = 60 * 1000; // 1 minute

    /**
     * Execute request with deduplication
     */
    async deduplicate<T>(
        key: string,
        fn: () => Promise<T>,
        ttl: number = this.ttl
    ): Promise<T> {
        const requestKey = this.generateKey(key);

        // Check if request is already in flight
        const inFlight = this.inFlightRequests.get(requestKey);
        if (inFlight) {
            this.logger.info('Request deduplicated (in-flight)', { key: requestKey });
            return inFlight.promise as Promise<T>;
        }

        // Check cache
        const cached = await this.getFromCache(requestKey);
        if (cached !== null) {
            this.logger.info('Request deduplicated (cached)', { key: requestKey });
            return cached;
        }

        // Execute request
        const promise = fn();
        this.inFlightRequests.set(requestKey, {
            key: requestKey,
            promise,
            timestamp: Date.now(),
        });

        try {
            const result = await promise;

            // Cache result
            await this.setInCache(requestKey, result, ttl);

            return result;
        } finally {
            // Clean up in-flight request
            this.inFlightRequests.delete(requestKey);
        }
    }

    /**
     * Generate cache key from request
     */
    private generateKey(input: string): string {
        return crypto.createHash('sha256').update(input).digest('hex');
    }

    /**
     * Get from Redis cache
     */
    private async getFromCache(key: string): Promise<any> {
        try {
            const cached = await redisClient.get(`dedup:${key}`);
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            this.logger.error('Cache get error', error);
            return null;
        }
    }

    /**
     * Set in Redis cache
     */
    private async setInCache(key: string, value: any, ttl: number): Promise<void> {
        try {
            await redisClient.setex(
                `dedup:${key}`,
                Math.ceil(ttl / 1000),
                JSON.stringify(value)
            );
        } catch (error) {
            this.logger.error('Cache set error', error);
        }
    }

    /**
     * Clean up expired in-flight requests
     */
    cleanup(): void {
        const now = Date.now();
        for (const [key, request] of this.inFlightRequests) {
            if (now - request.timestamp > this.ttl) {
                this.inFlightRequests.delete(key);
            }
        }
    }
}

export default new DeduplicationService();
