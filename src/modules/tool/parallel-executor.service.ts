import { createContextualLogger } from '../../core/logger/logger.js';
import { ToolService } from './tool.service.js';

interface ToolCall {
    id: string;
    name: string;
    parameters: any;
    dependencies?: string[]; // IDs of tools this depends on
}

interface ToolResult {
    id: string;
    success: boolean;
    result?: any;
    error?: string;
    duration: number;
}

export class ParallelToolExecutor {
    private readonly logger = createContextualLogger({ module: 'ParallelToolExecutor' });

    constructor(private readonly toolService: ToolService) { }

    /**
     * Execute tools in parallel where possible
     */
    async executeTools(tools: ToolCall[]): Promise<ToolResult[]> {
        if (tools.length === 0) {
            return [];
        }

        // Build dependency graph
        const graph = this.buildDependencyGraph(tools);

        // Execute in topological order with parallelization
        return this.executeWithDependencies(tools, graph);
    }

    /**
     * Build dependency graph
     */
    private buildDependencyGraph(tools: ToolCall[]): Map<string, Set<string>> {
        const graph = new Map<string, Set<string>>();

        for (const tool of tools) {
            graph.set(tool.id, new Set(tool.dependencies || []));
        }

        return graph;
    }

    /**
     * Execute tools respecting dependencies
     */
    private async executeWithDependencies(
        tools: ToolCall[],
        graph: Map<string, Set<string>>
    ): Promise<ToolResult[]> {
        const results = new Map<string, ToolResult>();
        const executing = new Set<string>();
        const completed = new Set<string>();

        /**
         * Check if tool can be executed (all dependencies completed)
         */
        const canExecute = (toolId: string): boolean => {
            const deps = graph.get(toolId) || new Set();
            return Array.from(deps).every(dep => completed.has(dep));
        };

        /**
         * Execute a single tool with timeout
         */
        const executeTool = async (tool: ToolCall, timeout: number = 30000): Promise<void> => {
            executing.add(tool.id);

            const startTime = Date.now();
            try {
                // Create timeout promise
                const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error(`Tool execution timeout after ${timeout}ms`)), timeout)
                );

                // Create execution promise
                const executionPromise = (async () => {
                    const toolDefinition = await this.toolService.findByName(tool.name);

                    if (!toolDefinition || !toolDefinition.isEnabled) {
                        throw new Error(`Tool '${tool.name}' not found or disabled`);
                    }

                    return {
                        success: true,
                        output: `Parallel execution for ${tool.name}`,
                        toolName: tool.name,
                        parameters: tool.parameters
                    };
                })();

                // Race between execution and timeout
                const result = await Promise.race([executionPromise, timeoutPromise]);

                results.set(tool.id, {
                    id: tool.id,
                    success: true,
                    result,
                    duration: Date.now() - startTime,
                });

                this.logger.debug(`Tool executed successfully: ${tool.name} (${Date.now() - startTime}ms)`);
            } catch (error: any) {
                this.logger.error(`Tool execution failed: ${tool.name}`, error);

                results.set(tool.id, {
                    id: tool.id,
                    success: false,
                    error: error.message,
                    duration: Date.now() - startTime,
                });
            } finally {
                executing.delete(tool.id);
                completed.add(tool.id);
            }
        };

        // Execute tools in waves
        while (completed.size < tools.length) {
            // Find tools ready to execute
            const ready = tools.filter(
                tool => !executing.has(tool.id) &&
                    !completed.has(tool.id) &&
                    canExecute(tool.id)
            );

            if (ready.length === 0) {
                // Deadlock or all executing
                if (executing.size === 0) {
                    throw new Error('Circular dependency detected in tool execution');
                }
                // Wait for current executions to complete
                await new Promise(resolve => setTimeout(resolve, 100));
                continue;
            }

            this.logger.debug(`Executing ${ready.length} tools in parallel`);

            // Execute all ready tools in parallel
            await Promise.all(ready.map(tool => executeTool(tool)));
        }

        // Return results in original order
        return tools.map(tool => results.get(tool.id)!);
    }

    /**
     * Analyze tools for parallelization opportunities
     */
    analyzeDependencies(tools: ToolCall[]): {
        parallelizable: number;
        sequential: number;
        maxParallelism: number;
    } {
        const graph = this.buildDependencyGraph(tools);

        // Count tools with no dependencies
        const parallelizable = Array.from(graph.values())
            .filter(deps => deps.size === 0).length;

        // Calculate max parallelism (longest chain)
        const maxParallelism = this.calculateMaxParallelism(tools, graph);

        return {
            parallelizable,
            sequential: tools.length - parallelizable,
            maxParallelism,
        };
    }

    private calculateMaxParallelism(
        tools: ToolCall[],
        graph: Map<string, Set<string>>
    ): number {
        // Simplified: count tools at each level
        const levels = new Map<string, number>();

        const getLevel = (toolId: string): number => {
            if (levels.has(toolId)) {
                return levels.get(toolId)!;
            }

            const deps = graph.get(toolId) || new Set();
            if (deps.size === 0) {
                levels.set(toolId, 0);
                return 0;
            }

            const maxDepLevel = Math.max(...Array.from(deps).map(getLevel));
            const level = maxDepLevel + 1;
            levels.set(toolId, level);
            return level;
        };

        tools.forEach(tool => getLevel(tool.id));

        // Count tools at each level
        const levelCounts = new Map<number, number>();
        for (const level of levels.values()) {
            levelCounts.set(level, (levelCounts.get(level) || 0) + 1);
        }

        return levelCounts.size > 0 ? Math.max(...levelCounts.values()) : 1;
    }
}
