// src/middleware/cache.middleware.ts
import { Request, Response, NextFunction } from 'express';
import cacheService from '../core/cache/cache.service.js';
import { createContextualLogger } from '../core/logger/logger.js';

interface CacheOptions {
    ttl?: number; // Time to live in seconds
    keyPrefix?: string; // Optional prefix for cache key
    enabled?: boolean; // Enable/disable caching
}

interface CustomRequest extends Request {
    fullUser?: {
        userId: string;
    };
}

const logger = createContextualLogger({ module: 'CacheMiddleware' });

/**
 * Generate cache key from request
 * Format: {prefix}:{userId}:{path}
 */
function generateCacheKey(req: CustomRequest, prefix?: string): string {
    const userId = req.fullUser?.userId || (req as any).userId || 'anonymous';
    const path = req.path.replace(/\//g, ':'); // Convert /user/profile to :user:profile
    const baseKey = `${userId}${path}`;
    return prefix ? `${prefix}:${baseKey}` : baseKey;
}

/**
 * Cache middleware for GET requests
 * Automatically caches responses and serves from cache when available
 * 
 * @param options Configuration options
 * @returns Express middleware function
 * 
 * @example
 * router.get('/profile', authMiddleware, cacheMiddleware({ ttl: 600 }), controller.getProfile);
 */
export const cacheMiddleware = (options: CacheOptions = {}) => {
    const {
        ttl = 300, // Default 5 minutes
        keyPrefix = 'api',
        enabled = true
    } = options;

    return async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        // Skip if caching is disabled
        if (!enabled) {
            return next();
        }

        // Generate cache key
        const cacheKey = generateCacheKey(req, keyPrefix);

        try {
            // Try to get from cache
            const cachedData = await cacheService.get(cacheKey);
            
            if (cachedData) {
                // Cache HIT - return cached response
                logger.debug('Serving from cache', { key: cacheKey, path: req.path });
                res.json(cachedData);
                return;
            }

            // Cache MISS - intercept response to cache it
            logger.debug('Cache miss, will cache response', { key: cacheKey, path: req.path });

            // Store original res.json function
            const originalJson = res.json.bind(res);

            // Override res.json to cache the response
            res.json = function(data: any) {
                // Cache the response asynchronously (don't wait)
                cacheService.set(cacheKey, data, ttl).catch(err => {
                    logger.error('Failed to cache response', { key: cacheKey, error: err.message });
                });

                // Call original json function
                return originalJson(data);
            };

            next();
        } catch (error: any) {
            // On error, just continue without caching
            logger.error('Cache middleware error', { error: error.message, path: req.path });
            next();
        }
    };
};

/**
 * Cache invalidation middleware
 * Invalidates cache for specific patterns after write operations
 * 
 * @param patterns Array of cache key patterns to invalidate
 * @returns Express middleware function
 * 
 * @example
 * router.put('/profile', authMiddleware, invalidateCache(['api:*:profile']), controller.updateProfile);
 */
export const invalidateCache = (patterns: string[]) => {
    return async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
        // Store original res.json function
        const originalJson = res.json.bind(res);

        // Override res.json to invalidate cache after successful response
        res.json = function(data: any) {
            // Only invalidate on successful responses (2xx status codes)
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const userId = req.fullUser?.userId || (req as any).userId;
                
                // Replace {userId} placeholder in patterns
                const resolvedPatterns = patterns.map(pattern => 
                    pattern.replace('{userId}', userId || '*')
                );

                // Invalidate cache asynchronously
                Promise.all(
                    resolvedPatterns.map(pattern => cacheService.delPattern(pattern))
                ).catch(err => {
                    logger.error('Failed to invalidate cache', { patterns: resolvedPatterns, error: err.message });
                });

                logger.debug('Cache invalidated', { patterns: resolvedPatterns });
            }

            // Call original json function
            return originalJson(data);
        };

        next();
    };
};

export default cacheMiddleware;
