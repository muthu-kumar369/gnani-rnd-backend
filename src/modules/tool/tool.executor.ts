// gnani-rnd-backend/src/modules/tool/tool.executor.ts

import { toolQueue } from '../../queues/tool.queue.js';
import { EventEmitter } from 'events';
import { createContextualLogger } from '../../core/logger/logger.js';

const logger = createContextualLogger({ module: 'ToolExecutor' });

export class ToolExecutor extends EventEmitter {
    /**
     * Execute tool with timeout support
     * @param toolName Name of the tool to execute
     * @param params Tool parameters
     * @param sessionId Session ID
     * @param timeout Timeout in milliseconds (default: 30000ms = 30s)
     */
    async executeToolWithTimeout(
        toolName: string,
        params: any,
        sessionId: string,
        timeout: number = 30000
    ): Promise<any> {
        logger.info('Executing tool with timeout', { toolName, sessionId, timeout });

        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Tool execution timeout after ${timeout}ms`)), timeout)
        );

        // Create execution promise
        const executionPromise = this.executeTool(toolName, params, sessionId);

        try {
            // Race between execution and timeout
            const result = await Promise.race([executionPromise, timeoutPromise]);
            logger.info('Tool execution completed', { toolName, sessionId });
            return result;
        } catch (error: any) {
            if (error.message.includes('timeout')) {
                logger.warn('Tool execution timed out', { toolName, sessionId, timeout });
                // Try to cancel the job if it's still running
                const jobResult = await executionPromise;
                if (jobResult && (jobResult as any).jobId) {
                    await this.cancelJob((jobResult as any).jobId);
                }
            }
            throw error;
        }
    }

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
