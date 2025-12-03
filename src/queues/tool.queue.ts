// gnani-rnd-backend/src/queues/tool.queue.ts

import { Queue, Worker, Job } from 'bullmq';
import redisClient from '../config/redis.config.js';
import toolRegistry from '../modules/tools/tool.registry.js';
import { createContextualLogger } from '../core/logger/logger.js';

const logger = createContextualLogger({ module: 'ToolQueue' });

export const toolQueue = new Queue('tools', { connection: redisClient });

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
    { connection: redisClient, concurrency: 5 }
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
