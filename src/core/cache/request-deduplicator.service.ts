import { cacheService } from './cache.service.js';
import { createContextualLogger } from '../logger/logger.js';
import crypto from 'crypto';

interface PendingRequest<T> {
    promise: Promise<T>;
    resolvers: Array<(value: T) => void>;
    rejectors: Array<(error: any) => void>;
}

export class RequestDeduplicator {
    private readonly logger = createContextualLogger({ module: 'RequestDeduplicator' });
    private readonly pendingRequests = new Map<string, PendingRequest<any>>();
    private stats = {
        totalRequests: 0,
        deduplicated: 0,
        cacheHits: 0,
    };

    /**
     * Deduplicate identical requests
     */
    async deduplicate<T>(
        key: string,
        fn: () => Promise<T>,
        ttl: number = 60
    ): Promise<T> {
        this.stats.totalRequests++;
        const requestKey = this.generateKey(key);

        // Check if request is already pending
        if (this.pendingRequests.has(requestKey)) {
            this.stats.deduplicated++;
            this.logger.debug(`Request deduplicated (in-flight): ${key.substring(0, 50)}...`);
            return this.waitForPending(requestKey);
        }

        // Check cache
        const cached = await cacheService.get<T>(requestKey);
        if (cached) {
            this.stats.cacheHits++;
            this.logger.debug(`Request deduplicated (cached): ${key.substring(0, 50)}...`);
            return cached;
        }

        // Execute request
        return this.executeAndCache(requestKey, fn, ttl);
    }

    /**
     * Wait for pending request
     */
    private waitForPending<T>(key: string): Promise<T> {
        return new Promise((resolve, reject) => {
            const pending = this.pendingRequests.get(key)!;
            pending.resolvers.push(resolve);
            pending.rejectors.push(reject);
        });
    }

    /**
     * Execute request and cache result
     */
    private async executeAndCache<T>(
        requestKey: string,
        fn: () => Promise<T>,
        ttl: number
    ): Promise<T> {
        const pending: PendingRequest<T> = {
            promise: fn(),
            resolvers: [],
            rejectors: [],
        };

        this.pendingRequests.set(requestKey, pending);

        try {
            const result = await pending.promise;

            // Cache result
            await cacheService.set(requestKey, result, ttl);

            // Resolve all waiting requests
            pending.resolvers.forEach(resolve => resolve(result));

            return result;
        } catch (error) {
            // Reject all waiting requests
            pending.rejectors.forEach(reject => reject(error));
            throw error;
        } finally {
            this.pendingRequests.delete(requestKey);
        }
    }

    /**
     * Generate cache key from request
     */
    private generateKey(input: string): string {
        return `dedup:${crypto.createHash('sha256').update(input).digest('hex')}`;
    }

    /**
     * Get deduplication statistics
     */
    getStats() {
        const deduplicationRate = this.stats.totalRequests > 0
            ? (this.stats.deduplicated + this.stats.cacheHits) / this.stats.totalRequests
            : 0;

        return {
            ...this.stats,
            deduplicationRate: (deduplicationRate * 100).toFixed(2) + '%',
            pendingRequests: this.pendingRequests.size,
        };
    }

    /**
     * Reset statistics
     */
    resetStats(): void {
        this.stats = {
            totalRequests: 0,
            deduplicated: 0,
            cacheHits: 0,
        };
    }

    /**
     * Clear all pending requests (for shutdown)
     */
    clearPending(): void {
        this.pendingRequests.clear();
    }
}

// Export singleton instance
export const requestDeduplicator = new RequestDeduplicator();
