// gnani-rnd-backend/src/modules/tool/tool.executor.ts

import { toolQueue } from '../../queues/tool.queue.js';
import { EventEmitter } from 'events';
import { createContextualLogger } from '../../core/logger/logger.js';

const logger = createContextualLogger({ module: 'ToolExecutor' });

export class ToolExecutor extends EventEmitter {
    async executeTool(toolName: string, params: any, sessionId: string) {
        logger.info('Queueing tool execution', { toolName, sessionId });

        // Add job to queue
        const job = await toolQueue.add('execute', {
            toolName,
            params,
            sessionId,
            timestamp: Date.now()
        });

        logger.info('Tool execution queued', { toolName, sessionId, jobId: job.id });

        // Return job ID for tracking
        return { jobId: job.id };
    }

    async getJobStatus(jobId: string) {
        const job = await toolQueue.getJob(jobId);
        if (!job) return null;

        const state = await job.getState();
        const progress = job.progress;

        return { state, progress };
    }

    async cancelJob(jobId: string) {
        const job = await toolQueue.getJob(jobId);
        if (job) {
            await job.remove();
            logger.info('Job cancelled', { jobId });
        }
    }
}

export const toolExecutor = new ToolExecutor();
