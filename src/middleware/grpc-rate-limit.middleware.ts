import { ServerUnaryCall, ServerWritableStream, status } from '@grpc/grpc-js';
import { redisClient } from '../config/redis.config.js';
import { createContextualLogger } from '../core/logger/logger.js';
import metrics from '../core/monitoring/metrics.js';

const logger = createContextualLogger({ module: 'GrpcRateLimiter' });

export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    keyGenerator?: (call: any) => string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
}

export class GrpcRateLimiter {
    constructor(private readonly config: RateLimitConfig) { }

    /**
     * Check rate limit for unary calls
     */
    async checkUnaryRateLimit(call: ServerUnaryCall<any, any>): Promise<void> {
        const key = this.generateKey(call);
        const rateLimitKey = `rate_limit:grpc:${key}`;

        try {
            const current = await redisClient.incr(rateLimitKey);

            if (current === 1) {
                // First request in window, set expiry
                await redisClient.expire(rateLimitKey, Math.ceil(this.config.windowMs / 1000));
            }

            if (current > this.config.maxRequests) {
                logger.warn('Rate limit exceeded', {
                    key,
                    current,
                    limit: this.config.maxRequests,
                    metadata: call.metadata.getMap(),
                });

                metrics.incrementRateLimitExceeded('grpc');

                throw {
                    code: status.RESOURCE_EXHAUSTED,
                    message: `Rate limit exceeded. Try again in ${this.config.windowMs / 1000}s`,
                    details: {
                        retryAfter: this.config.windowMs / 1000,
                        limit: this.config.maxRequests,
                        windowMs: this.config.windowMs,
                    },
                };
            }

            // Add rate limit info to metadata
            call.metadata.set('X-RateLimit-Limit', this.config.maxRequests.toString());
            call.metadata.set('X-RateLimit-Remaining', (this.config.maxRequests - current).toString());

        } catch (error: any) {
            if (error.code === status.RESOURCE_EXHAUSTED) {
                throw error;
            }
            logger.error('Rate limit check failed', { error: error.message });
            // Don't block request if rate limiting fails
        }
    }

    /**
     * Check rate limit for streaming calls
     */
    async checkStreamRateLimit(call: ServerWritableStream<any, any>): Promise<void> {
        return this.checkUnaryRateLimit(call as any);
    }

    /**
     * Generate rate limit key from call metadata
     */
    private generateKey(call: any): string {
        if (this.config.keyGenerator) {
            return this.config.keyGenerator(call);
        }

        // Default: Use user ID from JWT if available, otherwise IP
        const userId = call.metadata.get('user-id')?.[0];
        const ip = call.metadata.get('x-forwarded-for')?.[0] || call.getPeer();
        return userId || ip;
    }
}

/**
 * Factory function to create rate limiters for different endpoints
 */
export function createGrpcRateLimiter(config: Partial<RateLimitConfig> = {}): GrpcRateLimiter {
    const defaultConfig: RateLimitConfig = {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 100,
        ...config,
    };

    return new GrpcRateLimiter(defaultConfig);
}
