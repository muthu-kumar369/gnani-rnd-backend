import { Request, Response } from 'express';
import { redisClient } from '../config/redis.config.js';
import { createContextualLogger } from '../core/logger/logger.js';
import mongoose from 'mongoose';

const logger = createContextualLogger({ module: 'HealthController' });

export class HealthController {
    private isReady = false;
    private startupComplete = false;

    /**
     * Liveness probe - basic health check
     * Returns 200 if app is running, 500 if not
     */
    async liveness(req: Request, res: Response): Promise<void> {
        res.status(200).json({
            status: 'ok',
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Readiness probe - check if app can serve traffic
     * Returns 200 if ready, 503 if not
     */
    async readiness(req: Request, res: Response): Promise<void> {
        const checks = await Promise.all([
            this.checkMongoDB(),
            this.checkRedis(),
            this.checkOllama(),
        ]);

        const allHealthy = checks.every(check => check.healthy);

        if (allHealthy) {
            this.isReady = true;
            res.status(200).json({
                status: 'ready',
                checks: checks.map(c => ({ name: c.name, status: 'healthy' })),
                timestamp: new Date().toISOString(),
            });
        } else {
            this.isReady = false;
            res.status(503).json({
                status: 'not ready',
                checks: checks.map(c => ({
                    name: c.name,
                    status: c.healthy ? 'healthy' : 'unhealthy',
                    error: c.error,
                })),
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * Startup probe - check if app has finished starting
     */
    async startup(req: Request, res: Response): Promise<void> {
        // Simple startup check - if we can serve this request, basic initialization is done
        res.status(200).json({
            status: 'started',
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Check MongoDB connection
     */
    private async checkMongoDB(): Promise<{ name: string; healthy: boolean; error?: string }> {
        try {
            if (mongoose.connection.readyState === 1) {
                return { name: 'mongodb', healthy: true };
            }
            return { name: 'mongodb', healthy: false, error: 'MongoDB not connected' };
        } catch (error: any) {
            logger.error('MongoDB health check failed', { error: error.message });
            return { name: 'mongodb', healthy: false, error: error.message };
        }
    }

    /**
     * Check Redis connection
     */
    private async checkRedis(): Promise<{ name: string; healthy: boolean; error?: string }> {
        try {
            await redisClient.ping();
            return { name: 'redis', healthy: true };
        } catch (error: any) {
            logger.error('Redis health check failed', { error: error.message });
            return { name: 'redis', healthy: false, error: error.message };
        }
    }

    /**
     * Check Ollama connection
     */
    private async checkOllama(): Promise<{ name: string; healthy: boolean; error?: string }> {
        try {
            // Check if Ollama is reachable
            const ollamaUrl = process.env.LLM_SERVER_URL || 'http://localhost:11434';
            // Use fetch (available in Node 18+)
            const response = await fetch(`${ollamaUrl}/api/tags`);

            if (response.ok) {
                return { name: 'ollama', healthy: true };
            }
            return { name: 'ollama', healthy: false, error: `Ollama returned status ${response.status}` };
        } catch (error: any) {
            // Log but don't fail readiness if Ollama is optional for startup, 
            // BUT for production readiness it should be available.
            // Let's mark it as unhealthy if it fails.
            logger.error('Ollama health check failed', { error: error.message });
            return { name: 'ollama', healthy: false, error: error.message };
        }
    }
}
