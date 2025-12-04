// src/modules/session/tool.executor.ts
import { createContextualLogger } from '../../core/logger/logger.js';
import toolRegistry from '../tools/tool.registry.js';
import metrics from '../../core/monitoring/metrics.js';
import toolCache from '../../core/cache/tool-cache.service.js';
import FEATURE_FLAGS from '../../config/feature-flags.js';
import { Logger } from 'winston';

export class ToolExecutor {
    private logger: Logger;
    private DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
    private toolTimeouts: Map<string, number> = new Map([
        ['weather', 10000],      // 10s for weather API
        ['search', 15000],       // 15s for search
        ['calculator', 5000],    // 5s for calculator
        ['time', 1000],          // 1s for time
        ['date', 1000],          // 1s for date
        ['screenshot', 5000],    // 5s for screenshot
        ['system_info', 3000],   // 3s for system info
    ]);
    private pendingTools: Map<string, Set<string>> = new Map(); // sessionId -> Set of toolNames

    constructor() {
        this.logger = createContextualLogger({ module: 'ToolExecutor' });
        this.logger.info('ToolExecutor initialized with timeout protection');
    }

    async executeTools(
        sessionId: string,
        toolCalls: any[],
        onStatus?: (status: any) => Promise<void> | void
    ): Promise<any[]> {
        const results = [];

        for (const toolCall of toolCalls) {
            try {
                const toolName = toolCall.name || toolCall.tool;
                const toolParams = toolCall.parameters || toolCall.params;

                this.logger.info('Executing tool', {
                    sessionId,
                    tool: toolName
                });

                // Track pending tool
                if (!this.pendingTools.has(sessionId)) {
                    this.pendingTools.set(sessionId, new Set());
                }
                this.pendingTools.get(sessionId)!.add(toolName);

                // Month-3: Check tool cache first
                if (FEATURE_FLAGS.ENABLE_TOOL_CACHE) {
                    const cached = await toolCache.get(toolName, toolParams);
                    if (cached) {
                        this.logger.info('Using cached tool result', { tool: toolName });
                        this.pendingTools.get(sessionId)?.delete(toolName);
                        results.push(cached);
                        continue;
                    }
                }

                // Month-2: Track tool execution duration
                const startTime = Date.now();

                // NEW: Execute with timeout protection
                const timeout = this.toolTimeouts.get(toolName) || this.DEFAULT_TIMEOUT_MS;
                const result = await Promise.race([
                    toolRegistry.executeTool(toolName, toolParams, onStatus),
                    this.createTimeout(timeout, toolName)
                ]);

                const duration = Date.now() - startTime;

                // Remove from pending
                this.pendingTools.get(sessionId)?.delete(toolName);

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
                    duration,
                    timeout
                });

            } catch (error: any) {
                const toolName = toolCall.name || toolCall.tool;

                // Remove from pending
                this.pendingTools.get(sessionId)?.delete(toolName);

                // Month-2: Track failed tool execution
                const isTimeout = error.message.includes('timeout');
                metrics.recordToolExecution(toolName, 0, 'failure');

                this.logger.error('Tool execution failed', {
                    sessionId,
                    tool: toolName,
                    error: error.message,
                    isTimeout
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

    /**
     * Create a timeout promise that rejects after specified milliseconds
     */
    private createTimeout(ms: number, toolName: string): Promise<never> {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Tool '${toolName}' execution timeout after ${ms}ms`));
            }, ms);
        });
    }

    /**
     * Cancel all pending tools for a session
     * Called during session cleanup
     */
    async cancelPending(sessionId: string): Promise<void> {
        const pendingToolNames = this.pendingTools.get(sessionId);

        if (pendingToolNames && pendingToolNames.size > 0) {
            this.logger.info(`Cancelling ${pendingToolNames.size} pending tool(s) for session ${sessionId}`, {
                tools: Array.from(pendingToolNames)
            });

            // Clear pending tools
            this.pendingTools.delete(sessionId);

            // Note: Actual cancellation depends on tool implementation
            // Most tools don't support cancellation, so we just remove tracking
        } else {
            this.logger.debug(`No pending tools to cancel for session ${sessionId}`);
        }
    }
}
