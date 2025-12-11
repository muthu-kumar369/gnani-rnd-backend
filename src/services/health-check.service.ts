import { createContextualLogger } from '../core/logger/logger.js';
import mongoose from 'mongoose';
import { redisClient } from '../config/redis.config.js';
import { Logger } from 'winston';
import config from '../config/app.config.js';

const logger = createContextualLogger({ module: 'HealthCheckService' });

export interface ServiceHealth {
    healthy: boolean;
    latency?: number;
    error?: string;
}

export interface HealthStatus {
    status: 'healthy' | 'degraded';
    timestamp: string;
    services: {
        mongodb: ServiceHealth;
        redis: ServiceHealth;
        llm: ServiceHealth;
        whisper: ServiceHealth;
        chromadb: ServiceHealth;
    };
}

/**
 * STAGE 1: Health Check Service
 * Comprehensive health checks for all services
 */
export class HealthCheckService {
    /**
     * Check all services health
     * Uses Promise.allSettled to ensure all checks complete even if some fail
     */
    async checkAll(): Promise<HealthStatus> {
        const checks = await Promise.allSettled([
            this.checkMongoDB(),
            this.checkRedis(),
            this.checkLLM(),
            this.checkWhisper(),
            this.checkChromaDB(),
        ]);

        const results = {
            mongodb: checks[0].status === 'fulfilled' ? checks[0].value : { healthy: false, error: 'Check failed' },
            redis: checks[1].status === 'fulfilled' ? checks[1].value : { healthy: false, error: 'Check failed' },
            llm: checks[2].status === 'fulfilled' ? checks[2].value : { healthy: false, error: 'Check failed' },
            whisper: checks[3].status === 'fulfilled' ? checks[3].value : { healthy: false, error: 'Check failed' },
            chromadb: checks[4].status === 'fulfilled' ? checks[4].value : { healthy: false, error: 'Check failed' },
        };

        const allHealthy = Object.values(results).every(r => r.healthy);

        return {
            status: allHealthy ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            services: results
        };
    }

    /**
     * Check MongoDB connection
     */
    private async checkMongoDB(): Promise<ServiceHealth> {
        const startTime = Date.now();
        try {
            if (!mongoose.connection.db) {
                return { healthy: false, error: 'MongoDB not connected' };
            }
            await mongoose.connection.db.admin().ping();
            const latency = Date.now() - startTime;
            return { healthy: true, latency };
        } catch (error: any) {
            logger.error('MongoDB health check failed', { error: error.message });
            return { healthy: false, error: error.message };
        }
    }

    /**
     * Check Redis connection
     */
    private async checkRedis(): Promise<ServiceHealth> {
        const startTime = Date.now();
        try {
            await redisClient.ping();
            const latency = Date.now() - startTime;
            return { healthy: true, latency };
        } catch (error: any) {
            logger.error('Redis health check failed', { error: error.message });
            return { healthy: false, error: error.message };
        }
    }

    /**
     * Check LLM (Ollama) connection
     */
    private async checkLLM(): Promise<ServiceHealth> {
        const startTime = Date.now();
        try {
            // STAGE 1: Use centralized config
            const ollamaUrl = config.LLM_SERVER_URL;
            const response = await fetch(`${ollamaUrl}/api/tags`);

            if (response.ok) {
                const latency = Date.now() - startTime;
                return { healthy: true, latency };
            }
            return { healthy: false, error: `LLM returned status ${response.status}` };
        } catch (error: any) {
            logger.error('LLM health check failed', { error: error.message });
            return { healthy: false, error: error.message };
        }
    }

    /**
     * Check Whisper.cpp availability
     */
    private async checkWhisper(): Promise<ServiceHealth> {
        try {
            const fs = await import('fs');
            const path = await import('path');
            const os = await import('os');

            const homeDir = os.homedir();
            const whisperPath = path.join(homeDir, '.gnani', 'whisper.cpp', 'build', 'bin', 'whisper-cli');
            const modelPath = path.join(homeDir, '.gnani', 'whisper.cpp', 'models', 'ggml-base.en.bin');

            const whisperExists = fs.existsSync(whisperPath);
            const modelExists = fs.existsSync(modelPath);

            if (whisperExists && modelExists) {
                return { healthy: true };
            }

            const error = !whisperExists ? 'Whisper binary not found' : 'Whisper model not found';
            return { healthy: false, error };
        } catch (error: any) {
            logger.error('Whisper health check failed', { error: error.message });
            return { healthy: false, error: error.message };
        }
    }

    /**
     * Check ChromaDB availability
     */
    private async checkChromaDB(): Promise<ServiceHealth> {
        const startTime = Date.now();
        try {
            // STAGE 1: Use centralized config
            const chromaUrl = `http://${config.CHROMA_HOST}:${config.CHROMA_PORT}`;
            const response = await fetch(`${chromaUrl}/api/v1/heartbeat`);

            if (response.ok) {
                const latency = Date.now() - startTime;
                return { healthy: true, latency };
            }
            return { healthy: false, error: `ChromaDB returned status ${response.status}` };
        } catch (error: any) {
            logger.error('ChromaDB health check failed', { error: error.message });
            return { healthy: false, error: error.message };
        }
    }
}

// Export singleton instance
export const healthCheckService = new HealthCheckService();
export default healthCheckService;
