// src/modules/session/tool.executor.ts
import { createContextualLogger } from '../../core/logger/logger.js';
import toolRegistry from '../tools/tool.registry.js';
import metrics from '../../core/monitoring/metrics.js';
import toolCache from '../../core/cache/tool-cache.service.js';
import FEATURE_FLAGS from '../../config/feature-flags.js';
import { Logger } from 'winston';

export class ToolExecutor {
    private logger: Logger;

    constructor() {
        this.logger = createContextualLogger({ module: 'ToolExecutor' });
    }

    async executeTools(
        sessionId: string,
        toolCalls: any[],
        onStatus?: (status: any) => Promise<void> | void
    ): Promise<any[]> {
        const results = [];

        for (const toolCall of toolCalls) {
            try {
                this.logger.info('Executing tool', { 
                    sessionId, 
                    tool: toolCall.name || toolCall.tool
                });

                const toolName = toolCall.name || toolCall.tool;
                const toolParams = toolCall.parameters || toolCall.params;

                // Month-3: Check tool cache first
                if (FEATURE_FLAGS.ENABLE_TOOL_CACHE) {
                    const cached = await toolCache.get(toolName, toolParams);
                    if (cached) {
                        this.logger.info('Using cached tool result', { tool: toolName });
                        results.push(cached);
                        continue;
                    }
                }

                // Month-2: Track tool execution duration
                const startTime = Date.now();

                const result = await toolRegistry.executeTool(
                    toolName,
                    toolParams,
                    onStatus
                );

                const duration = Date.now() - startTime;
                metrics.recordToolExecution(toolName, duration, 'success');

                // Month-3: Cache the result
                if (FEATURE_FLAGS.ENABLE_TOOL_CACHE) {
                    await toolCache.set(toolName, toolParams, result);
                }

                results.push(result);

                this.logger.info('Tool execution completed', {
                    sessionId,
                    tool: toolName,
                    success: true,
                    duration
                });

            } catch (error: any) {
                const toolName = toolCall.name || toolCall.tool;
                
                // Month-2: Track failed tool execution
                metrics.recordToolExecution(toolName, 0, 'failure');
                
                this.logger.error('Tool execution failed', {
                    sessionId,
                    tool: toolName,
                    error: error.message
                });

                results.push({
                    toolName,
                    error: error.message,
                    success: false
                });
            }
        }

        return results;
    }
}
