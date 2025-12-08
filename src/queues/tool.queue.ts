// gnani-rnd-backend/src/queues/tool.queue.ts

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB } from '../config/env.config.js';
import toolRegistry from '../modules/tools/tool.registry.js';
import { createContextualLogger } from '../core/logger/logger.js';

const logger = createContextualLogger({ module: 'ToolQueue' });

// Create a dedicated Redis connection for BullMQ
// BullMQ requires maxRetriesPerRequest to be null
const bullMqConnection = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD || undefined,
    db: REDIS_DB,
    maxRetriesPerRequest: null,
});

export const toolQueue = new Queue('tools', { connection: bullMqConnection });
export const toolQueueEvents = new QueueEvents('tools', { connection: bullMqConnection });

// Worker to process tool execution
export const toolWorker = new Worker(
    'tools',
    async (job: Job) => {
        const { toolName, params, sessionId } = job.data;

        logger.info('Executing tool', { toolName, sessionId, jobId: job.id });

        try {
            // Update progress: started
            await job.updateProgress(10);

            // Execute tool
            const tool = toolRegistry.getTool(toolName);
            if (!tool) {
                throw new Error(`Tool ${toolName} not found`);
            }

            // Update progress: executing
            await job.updateProgress(50);

            const result = await tool.execute(params);

            // Update progress: complete
            await job.updateProgress(100);

            logger.info('Tool execution complete', { toolName, sessionId, jobId: job.id });

            return result;
        } catch (error: any) {
            logger.error('Tool execution failed', error, { toolName, sessionId, jobId: job.id });
            throw error;
        }
    },
    { connection: bullMqConnection, concurrency: 5 }
);

// Event listeners
toolWorker.on('completed', (job) => {
    logger.info('Job completed', { jobId: job.id });
});

toolWorker.on('failed', (job, error) => {
    logger.error('Job failed', error, { jobId: job?.id });
});

toolWorker.on('progress', (job, progress) => {
    logger.debug('Job progress', { jobId: job.id, progress });
});
