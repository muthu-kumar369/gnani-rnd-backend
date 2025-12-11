import { Request, Response } from 'express';
import { redisClient } from '../config/redis.config.js';
import { createContextualLogger } from '../core/logger/logger.js';
import mongoose from 'mongoose';
import config from '../config/app.config.js';

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
        // STAGE 1: Enhanced health checks including Whisper and ChromaDB
        const checks = await Promise.all([
            this.checkMongoDB(),
            this.checkRedis(),
            this.checkOllama(),
            this.checkWhisper(),
            this.checkChromaDB(),
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
     * STAGE 1: Comprehensive health check using service
     */
    async health(req: Request, res: Response): Promise<void> {
        try {
            const { healthCheckService } = await import('../services/health-check.service.js');
            const healthStatus = await healthCheckService.checkAll();

            const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
            res.status(statusCode).json(healthStatus);
        } catch (error: any) {
            logger.error('Health check failed', { error: error.message });
            res.status(500).json({
                status: 'error',
                timestamp: new Date().toISOString(),
                error: error.message
            });
        }
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
            // STAGE 1: Use centralized config
            const ollamaUrl = config.LLM_SERVER_URL;
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

    /**
     * STAGE 1: Check Whisper.cpp availability
     */
    private async checkWhisper(): Promise<{ name: string; healthy: boolean; error?: string }> {
        try {
            // Check if Whisper.cpp binary exists
            const fs = await import('fs');
            const path = await import('path');
            const os = await import('os');

            const homeDir = os.homedir();
            const whisperPath = path.join(homeDir, '.gnani', 'whisper.cpp', 'build', 'bin', 'whisper-cli');
            const modelPath = path.join(homeDir, '.gnani', 'whisper.cpp', 'models', 'ggml-base.en.bin');

            const whisperExists = fs.existsSync(whisperPath);
            const modelExists = fs.existsSync(modelPath);

            if (whisperExists && modelExists) {
                return { name: 'whisper', healthy: true };
            }

            const error = !whisperExists ? 'Whisper binary not found' : 'Whisper model not found';
            return { name: 'whisper', healthy: false, error };
        } catch (error: any) {
            logger.error('Whisper health check failed', { error: error.message });
            return { name: 'whisper', healthy: false, error: error.message };
        }
    }

    /**
     * STAGE 1: Check ChromaDB availability
     */
    private async checkChromaDB(): Promise<{ name: string; healthy: boolean; error?: string }> {
        try {
            // STAGE 1: Use centralized config
            const chromaUrl = `http://${config.CHROMA_HOST}:${config.CHROMA_PORT}`;
            const response = await fetch(`${chromaUrl}/api/v1/heartbeat`);

            if (response.ok) {
                return { name: 'chromadb', healthy: true };
            }
            return { name: 'chromadb', healthy: false, error: `ChromaDB returned status ${response.status}` };
        } catch (error: any) {
            logger.error('ChromaDB health check failed', { error: error.message });
            return { name: 'chromadb', healthy: false, error: error.message };
        }
    }
}
