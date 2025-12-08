// src/modules/admin/circuit-breaker.routes.ts
import express from 'express';
import { mongoCircuitBreaker } from '../../config/database.config.js';
import { redisCircuitBreaker } from '../../config/redis.config.js';

const router = express.Router();

/**
 * GET /api/admin/circuit-breakers
 * Get status of all circuit breakers
 */
router.get('/circuit-breakers', (req, res) => {
    const breakers = {
        mongodb: mongoCircuitBreaker.getStats(),
        redis: redisCircuitBreaker.getStats(),
        // Note: ChromaDB, Whisper, and Tool circuit breakers are instance-specific
        // and would need to be exported from their respective modules to be included here
    };

    res.json({
        success: true,
        breakers
    });
});

/**
 * POST /api/admin/circuit-breakers/:name/reset
 * Manually reset a circuit breaker to CLOSED state
 */
router.post('/circuit-breakers/:name/reset', (req, res) => {
    const { name } = req.params;

    // Map name to circuit breaker instance
    const breakers: Record<string, any> = {
        mongodb: mongoCircuitBreaker,
        redis: redisCircuitBreaker
    };

    const breaker = breakers[name];
    if (!breaker) {
        return res.status(404).json({
            success: false,
            error: `Circuit breaker '${name}' not found`
        });
    }

    breaker.forceClose();

    res.json({
        success: true,
        message: `Circuit breaker '${name}' reset to CLOSED`
    });
});

/**
 * POST /api/admin/circuit-breakers/:name/open
 * Manually force a circuit breaker to OPEN state (for testing)
 */
router.post('/circuit-breakers/:name/open', (req, res) => {
    const { name } = req.params;

    const breakers: Record<string, any> = {
        mongodb: mongoCircuitBreaker,
        redis: redisCircuitBreaker
    };

    const breaker = breakers[name];
    if (!breaker) {
        return res.status(404).json({
            success: false,
            error: `Circuit breaker '${name}' not found`
        });
    }

    breaker.forceOpen();

    res.json({
        success: true,
        message: `Circuit breaker '${name}' forced to OPEN`
    });
});

export default router;
