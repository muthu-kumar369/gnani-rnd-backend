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

logger.info('App initialization process started, checking for reloads...');

// Connect to MongoDB
connectDB();

// Connect to Redis
redisClient.connect().then(() => {
    logger.info('Redis client connected successfully');
}).catch((err: Error) => {
    logger.error(`Redis connection failed: ${err.message}`);
});

// Start Express.js server and get the http.Server instance
const httpServer = startExpressServer();
startGrpcServer();

// Initialize background jobs
logger.info('Initializing background jobs...');
memoryCleanupJob.schedule();
summarizationJob.schedule();

// Phase 4: Start cleanup jobs
cleanupJob.start();
mongoDBCleanupJob.start();
logger.info('Phase 4 cleanup jobs started (ChromaDB, MongoDB)');

// Phase 4: Task queue worker is automatically started when imported
logger.info('Phase 4 task queue worker started');

logger.info('Background jobs scheduled successfully');
logger.info('GNANI Backend application started.');


