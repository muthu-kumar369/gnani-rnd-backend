// backend/src/app.ts
import { startExpressServer } from './server.js';
import { startGrpcServer } from './grpc.js';
import connectDB from './config/database.config.js';
import logger from './core/logger/logger.js';
import redisClient from './config/redis.config.js';
import memoryCleanupJob from './jobs/memory-cleanup.job.js';
import summarizationJob from './jobs/conversation-summarization.job.js';

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
logger.info('Background jobs scheduled successfully');
logger.info('Initializing background jobs...');
memoryCleanupJob.schedule();
summarizationJob.schedule();
logger.info('Background jobs scheduled successfully');

logger.info('GNANI Backend application started.');

