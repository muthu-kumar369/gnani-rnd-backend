// backend/src/app.ts
import { startExpressServer } from './server.js';
import { startGrpcServer } from './grpc.js';
import connectDB from './config/database.config.js';
import logger from './core/logger/logger.js';
import redisClient from './config/redis.config.js';
import memoryCleanupJob from './jobs/memory-cleanup.job.js';
import summarizationJob from './jobs/conversation-summarization.job.js';
// Phase 4: Cleanup jobs
import { cleanupJob } from './jobs/cleanup.job.js';
import { mongoDBCleanupJob } from './jobs/mongodb-cleanup.job.js';
// Phase 4: Task queue worker
import { toolWorker } from './queues/tool.queue.js';
// Month-2: Monitoring and graceful shutdown
import { startTracing } from './core/monitoring/tracing.js';
import shutdownManager from './core/shutdown/shutdown-manager.js';
import metrics from './core/monitoring/metrics.js';
// Stage 4: Startup checks
import { runStartupChecks } from './core/startup/startup-checks.js';

import { templateService } from './modules/template/template.service.js';
import { toolService } from './modules/tool/tool.service.js';

// Initialize services
(async () => {
    try {
        logger.info('Starting GNANI Backend application...');

        // Connect to Redis
        try {
            await redisClient.connect();
            logger.info('Redis client connected successfully');
        } catch (err: any) {
            logger.error(`Redis connection failed: ${err.message}`);
            // Continue even if Redis fails? Or exit? Usually better to continue if cache is optional, but for session it might be critical.
            // Given previous code just logged error, we'll keep it non-fatal for now, but await it.
        }

        // Connect to MongoDB
        await connectDB();

        // Seed default templates
        await templateService.seedDefaults();
        // Seed default tools
        await toolService.seedDefaults();

        // Stage 4: Run startup checks
        logger.info('Running startup checks...');
        const checksPass = await runStartupChecks();
        if (!checksPass) {
            logger.error('Startup checks failed, exiting...');
            process.exit(1);
        }

        // Start Express.js server and get the http.Server instance
        const httpServer = startExpressServer();
        startGrpcServer();

        // Month-2: Register HTTP server with shutdown manager
        shutdownManager.setHttpServer(httpServer);

        // Initialize background jobs
        logger.info('Initializing background jobs...');
        memoryCleanupJob.schedule();
        summarizationJob.schedule();

        // Phase 4: Start cleanup jobs
        cleanupJob.start();
        mongoDBCleanupJob.start();
        logger.info('Phase 4 cleanup jobs started (ChromaDB, MongoDB)');

        // Stage 1: Start session cleanup job
        const { startSessionCleanupJob } = await import('./jobs/session-cleanup.job.js');
        startSessionCleanupJob();
        logger.info('Stage 1: Session cleanup job started');

        // Phase 4: Task queue worker is automatically started when imported
        logger.info('Phase 4 task queue worker started');

        logger.info('Background jobs scheduled successfully');
        logger.info('GNANI Backend application started.');

        // Month-2: Register graceful shutdown handlers
        process.on('SIGTERM', () => {
            logger.info('Received SIGTERM signal');
            shutdownManager.shutdown('SIGTERM');
        });

        process.on('SIGINT', () => {
            logger.info('Received SIGINT signal');
            shutdownManager.shutdown('SIGINT');
        });

        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
            shutdownManager.shutdown('UNCAUGHT_EXCEPTION');
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection', { reason, promise });
            shutdownManager.shutdown('UNHANDLED_REJECTION');
        });

        logger.info('Graceful shutdown handlers registered');

    } catch (error: any) {
        logger.error('Failed to start application', { error: error.message, stack: error.stack });
        process.exit(1);
    }
})();

