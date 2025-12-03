// src/routes/health.routes.ts
import express, { Request, Response } from 'express';
import logger from '../core/logger/logger.js';
import { llmManager } from '../core/llm/llm.manager.js';
import redisClient from '../config/redis.config.js';
import mongoose from 'mongoose';

const router = express.Router();

// Comprehensive health check
router.get('/health', async (req: Request, res: Response) => {
    const health = {
        status: 'healthy',
        timestamp: Date.now(),
        uptime: process.uptime(),
        checks: {
            llm: false,
            redis: false,
            mongodb: false
        }
    };

    try {
        // Check LLM
        health.checks.llm = await llmManager.currentProvider.isAvailable();

        // Check Redis
        await redisClient.ping();
        health.checks.redis = true;

        // Check MongoDB
        health.checks.mongodb = mongoose.connection.readyState === 1;

        // Overall status
        const allHealthy = Object.values(health.checks).every(v => v);
        health.status = allHealthy ? 'healthy' : 'degraded';

        logger.info('Health check', health);
        res.status(allHealthy ? 200 : 503).json(health);
    } catch (error: any) {
        health.status = 'unhealthy';
        logger.error('Health check failed', error);
        res.status(503).json(health);
    }
});

// Readiness check (for load balancers)
router.get('/ready', async (req: Request, res: Response) => {
    try {
        const llmReady = await llmManager.currentProvider.isAvailable();
        await redisClient.ping();

        if (llmReady && mongoose.connection.readyState === 1) {
            res.status(200).json({ ready: true });
        } else {
            res.status(503).json({ ready: false });
        }
    } catch (error) {
        res.status(503).json({ ready: false });
    }
});

// Liveness check (for orchestrators)
router.get('/live', (req: Request, res: Response) => {
    res.status(200).json({ alive: true });
});

// Legacy status endpoint
router.get('/', (req: Request, res: Response) => {
    logger.info('Status endpoint hit');
    res.status(200).send('OK');
});

export default router;
