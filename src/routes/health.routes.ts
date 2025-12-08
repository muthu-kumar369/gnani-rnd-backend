// src/routes/health.routes.ts
import express, { Request, Response } from 'express';
import logger from '../core/logger/logger.js';
import { llmManager } from '../core/llm/llm.manager.js';
import redisClient from '../config/redis.config.js';
import mongoose from 'mongoose';

const router = express.Router();

interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    checks: {
        [key: string]: {
            status: 'up' | 'down';
            latency?: number;
            message?: string;
        };
    };
}

/**
 * GET /health
 * Liveness probe - is the service running?
 */
router.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

/**
 * GET /health/ready
 * Readiness probe - is the service ready to accept traffic?
 */
router.get('/health/ready', async (req: Request, res: Response) => {
    const checks: HealthStatus['checks'] = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check MongoDB
    try {
        const start = Date.now();
        if (mongoose.connection.db) {
            await mongoose.connection.db.admin().ping();
            checks.mongodb = {
                status: 'up',
                latency: Date.now() - start
            };
        } else {
            checks.mongodb = {
                status: 'down',
                message: 'MongoDB connection not established'
            };
            overallStatus = 'unhealthy';
        }
    } catch (error: any) {
        checks.mongodb = {
            status: 'down',
            message: error.message
        };
        overallStatus = 'unhealthy';
    }

    // Check Redis
    try {
        const start = Date.now();
        await redisClient.ping();
        checks.redis = {
            status: 'up',
            latency: Date.now() - start
        };
    } catch (error: any) {
        checks.redis = {
            status: 'down',
            message: error.message
        };
        overallStatus = overallStatus === 'unhealthy' ? 'unhealthy' : 'degraded';
    }

    // Check LLM service
    try {
        const start = Date.now();
        const llmReady = await llmManager.currentProvider.isAvailable();
        checks.llm = {
            status: llmReady ? 'up' : 'down',
            latency: Date.now() - start
        };
        if (!llmReady) {
            overallStatus = overallStatus === 'unhealthy' ? 'unhealthy' : 'degraded';
        }
    } catch (error: any) {
        checks.llm = {
            status: 'down',
            message: error.message
        };
        overallStatus = overallStatus === 'unhealthy' ? 'unhealthy' : 'degraded';
    }

    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks
    });
});

/**
 * GET /health/detailed
 * Detailed health information (admin only)
 */
router.get('/health/detailed', async (req: Request, res: Response) => {
    const memUsage = process.memoryUsage();

    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
            rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
            external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
        },
        cpu: process.cpuUsage(),
        nodejs: process.version,
        pid: process.pid,
        platform: process.platform,
        arch: process.arch
    });
});

// Legacy endpoints for backward compatibility
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

router.get('/live', (req: Request, res: Response) => {
    res.status(200).json({ alive: true });
});

router.get('/', (req: Request, res: Response) => {
    logger.info('Status endpoint hit');
    res.status(200).send('OK');
});

export default router;
