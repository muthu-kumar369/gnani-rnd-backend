// src/core/startup/startup-checks.ts
import mongoose from 'mongoose';
import redis from '../../config/redis.config.js';
import { createContextualLogger } from '../logger/logger.js';

const logger = createContextualLogger({ module: 'StartupChecks' });

export async function runStartupChecks(): Promise<boolean> {
    logger.info('Running startup checks...');

    // Allow skipping startup checks in development
    if (process.env.SKIP_STARTUP_CHECKS === 'true') {
        logger.warn('⚠️  Startup checks skipped (SKIP_STARTUP_CHECKS=true)');
        return true;
    }

    const checks = [
        checkMongoDB(),
        checkRedis(),
        checkLLMService(),
        checkRequiredEnvVars()
    ];

    const results = await Promise.allSettled(checks);

    const failures = results.filter(r => r.status === 'rejected');

    if (failures.length > 0) {
        logger.error(`Startup checks failed: ${failures.length}/${checks.length}`);
        failures.forEach((f: any) => {
            logger.error(`  - ${f.reason}`);
        });
        return false;
    }

    logger.info('All startup checks passed ✓');
    return true;
}

async function checkMongoDB(): Promise<void> {
    try {
        if (!mongoose.connection.db) {
            throw new Error('MongoDB connection not established');
        }
        await mongoose.connection.db.admin().ping();
        logger.info('✓ MongoDB connection OK');
    } catch (error: any) {
        throw new Error(`MongoDB check failed: ${error.message}`);
    }
}

async function checkRedis(): Promise<void> {
    try {
        await redis.ping();
        logger.info('✓ Redis connection OK');
    } catch (error: any) {
        throw new Error(`Redis check failed: ${error.message}`);
    }
}

async function checkLLMService(): Promise<void> {
    try {
        // Skip LLM check if URL not configured (optional service)
        if (!process.env.LLM_SERVER_URL) {
            logger.warn('⚠️  LLM_SERVER_URL not configured, skipping LLM check');
            return;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${process.env.LLM_SERVER_URL}/health`, {
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`LLM service returned ${response.status}`);
        }
        logger.info('✓ LLM service OK');
    } catch (error: any) {
        // Make LLM check non-fatal but log warning
        logger.warn(`⚠️  LLM service check failed: ${error.message} (continuing anyway)`);
    }
}

function checkRequiredEnvVars(): Promise<void> {
    const required = [
        'MONGODB_URI',
        'REDIS_HOST',
        'JWT_SECRET'
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(`Missing required env vars: ${missing.join(', ')}`);
    }

    logger.info('✓ Environment variables OK');
    return Promise.resolve();
}
