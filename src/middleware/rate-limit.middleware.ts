import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import redisClient from '../config/redis.config.js';
import { createContextualLogger } from '../core/logger/logger.js';

const logger = createContextualLogger({ module: 'RateLimitMiddleware' });

// Helper to create Redis store
const createRedisStore = () => new RedisStore({
    // @ts-ignore - rate-limit-redis types are strict about the command signature
    sendCommand: (...args: string[]) => redisClient.call(...args),
});

// Global API Rate Limiter
// 300 requests per 15 minutes per IP (Increased from 100 for better UX)
export const globalRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    store: createRedisStore(),
    handler: (req, res, next, options) => {
        logger.warn(`Global rate limit exceeded for IP: ${req.ip}`);
        res.status(options.statusCode).json({
            error: 'Too many requests',
            message: 'You have exceeded the request limit. Please try again later.'
        });
    },
    skip: (req) => {
        // Skip rate limiting for internal services or whitelisted IPs if needed
        return req.ip === '127.0.0.1' || req.ip === '::1';
    }
});

// Strict Rate Limiter for Sensitive Endpoints (e.g., Auth, Payment)
// 10 requests per 15 minutes per IP (Increased from 5)
export const strictRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore(),
    handler: (req, res, next, options) => {
        logger.warn(`Strict rate limit exceeded for IP: ${req.ip} on ${req.originalUrl}`);
        res.status(options.statusCode).json({
            error: 'Too many attempts',
            message: 'Too many attempts. Please try again later.'
        });
    }
});

// DDoS Protection Limiter (Burst protection)
// 100 requests per 1 minute (Increased from 50)
export const burstLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore(),
    message: 'Too many requests, please slow down.'
});