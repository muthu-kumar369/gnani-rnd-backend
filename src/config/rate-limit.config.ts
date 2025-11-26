import rateLimit from 'express-rate-limit';

/**
 * Rate limiting configuration for OAuth routes
 */

// OAuth start endpoint rate limiter
// Prevents abuse of OAuth URL generation
export const oauthStartLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per window per IP
    message: 'Too many OAuth start requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// OAuth callback endpoint rate limiter
// More lenient since users may retry failed logins
export const oauthCallbackLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 requests per window per IP
    message: 'Too many OAuth callback requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// OAuth link/unlink endpoint rate limiter
// Stricter since these are authenticated operations

export const oauthLinkLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window per user
    message: 'Too many OAuth link/unlink requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    // Use userId as key instead of IP for authenticated routes
    keyGenerator: (req, res) => {
        return (req as any).userId || req.ip;
    },
    // Disable the IPv6 validation check to unblock dev
    validate: {
        ip: false,
        trustProxy: false
    }
});

// General auth endpoint rate limiter
// For login and register endpoints
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window per IP
    message: 'Too many authentication requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
