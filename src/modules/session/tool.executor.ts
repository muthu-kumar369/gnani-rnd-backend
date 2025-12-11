import { createContextualLogger } from '../../core/logger/logger.js';
import toolRegistry from '../tools/tool.registry.js';
import metrics from '../../core/monitoring/metrics.js';
import toolCache from '../../core/cache/tool-cache.service.js';
import FEATURE_FLAGS from '../../config/feature-flags.js';
import { Logger } from 'winston';
import { toolQueue, toolQueueEvents } from '../../queues/tool.queue.js';
import { CircuitBreaker } from '../../core/reliability/circuit-breaker.js';
import { ParallelToolExecutor } from '../tool/parallel-executor.service.js'; // Stage 4: Parallel execution
import { toolService } from '../tool/tool.service.js'; // Stage 4: For parallel executor
import { executeWithRecovery } from '../../core/utils/error-recovery.utils.js';

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
    private toolCircuitBreakers: Map<string, CircuitBreaker> = new Map(); // Stage 2

    constructor() {
        this.logger = createContextualLogger({ module: 'ToolExecutor' });
        this.logger.info('ToolExecutor initialized with timeout protection and circuit breakers');
    }

    // Stage 2: Get or create circuit breaker for a tool
    private getCircuitBreaker(toolName: string): CircuitBreaker {
        if (!this.toolCircuitBreakers.has(toolName)) {
            this.toolCircuitBreakers.set(
                toolName,
                new CircuitBreaker(`Tool:${toolName}`, {
                    failureThreshold: 3,
                    resetTimeoutMs: 15000,
                    requestTimeoutMs: 10000
                })
            );
        }
        return this.toolCircuitBreakers.get(toolName)!;
    }

    async executeTools(
        sessionId: string,
        toolCalls: any[],
        onStatus?: (status: any) => Promise<void> | void
    ): Promise<any[]> {
        // Stage 4: Use parallel execution when multiple tools requested
        if (toolCalls.length > 1) {
            this.logger.info(`Executing ${toolCalls.length} tools in parallel`, { sessionId });

            try {
                const parallelExecutor = new ParallelToolExecutor(toolService);
                const toolCallsWithDeps = toolCalls.map((call, i) => ({
                    id: `tool-${sessionId}-${i}`,
                    name: call.name || call.tool,
                    parameters: call.parameters || call.params,
                    dependencies: []
                }));

                return await parallelExecutor.executeTools(toolCallsWithDeps);
            } catch (error: any) {
                this.logger.warn(`Parallel execution failed, using sequential`, {
                    sessionId,
                    error: error.message
                });
                // Fall through to sequential
            }
        }

        // Sequential execution (single tool or fallback)
        const results = [];

        // TODO Stage 4: Replace with parallel execution for 3x performance
        // import { ParallelToolExecutor } from '../tool/parallel-executor.service.js';
        // const parallelExecutor = new ParallelToolExecutor(toolService);
        // return await parallelExecutor.executeTools(toolCallsWithDeps);

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

                // Stage 2: Get circuit breaker for this tool
                const circuitBreaker = this.getCircuitBreaker(toolName);

                // Execute via circuit breaker and queue
                // Execute via circuit breaker and recovery
                const timeout = this.toolTimeouts.get(toolName) || this.DEFAULT_TIMEOUT_MS;

                const result = await executeWithRecovery(async () => {
                    return await circuitBreaker.execute(async () => {
                        // Add job to queue
                        const job = await toolQueue.add('execute-tool', {
                            toolName,
                            params: toolParams,
                            sessionId
                        }, {
                            removeOnComplete: true,
                            removeOnFail: true
                        });

                        this.logger.info(`Added tool execution job to queue`, { jobId: job.id, tool: toolName });

                        // Wait for job completion with timeout
                        return await Promise.race([
                            job.waitUntilFinished(toolQueueEvents),
                            this.createTimeout(timeout, toolName)
                        ]);
                    });
                }, {
                    context: `Tool Execution (${toolName})`,
                    retries: 1, // Limited retries for tools
                    onError: (err: any) => this.logger.warn(`Tool ${toolName} execution failed: ${err.message}`)
                });

                const duration = Date.now() - startTime;

                // Remove from pending
                this.pendingTools.get(sessionId)?.delete(toolName);

                metrics.recordToolExecution(toolName, duration, 'success');

                // Month-3: Cache the result
                if (FEATURE_FLAGS.ENABLE_TOOL_CACHE) {
                    await toolCache.set(toolName, toolParams, result);
                }

                results.push(result);

                this.logger.info('Tool execution completed via queue', {
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
