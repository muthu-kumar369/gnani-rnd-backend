import { ITool, ToolDefinition, ToolExecutionResult } from './tool.interface.js';
import { createContextualLogger } from '../../core/logger/logger.js';
import { Logger } from 'winston';
import pluginManager from './plugin.manager.js';
import { CircuitBreaker } from '../../core/reliability/circuit-breaker.js';

class ToolRegistry {
    private tools: Map<string, ITool> = new Map();
    private logger: Logger;
    private circuitBreaker: CircuitBreaker;

    constructor() {
        this.logger = createContextualLogger({ module: 'ToolRegistry' });

        // Initialize Circuit Breaker for external tools
        this.circuitBreaker = new CircuitBreaker('EXTERNAL_TOOLS', {
            failureThreshold: 3,
            resetTimeoutMs: 60000, // 60 seconds
            requestTimeoutMs: 30000 // 30 seconds
        });
    }

    /**
     * Load all tools from plugins at startup
     */
    async loadAllTools(): Promise<void> {
        this.logger.info('Loading all tools from plugins...');
        await pluginManager.loadAllPlugins();

        // Register loaded plugins as tools
        const plugins = pluginManager.getLoadedPlugins();
        for (const plugin of plugins) {
            if (plugin.tools) {
                for (const toolDef of plugin.tools) {
                    const toolAdapter: ITool = {
                        name: toolDef.name,
                        description: toolDef.description,
                        parameters: toolDef.parameters,
                        execute: async (params: any) => {
                            const result = await plugin.executeTool(toolDef.name, params);
                            if (result.error) throw new Error(result.error);
                            return result.data;
                        }
                    };
                    this.registerTool(toolAdapter);
                }
            }
        }
        this.logger.info(`Total tools loaded: ${this.tools.size}`);
    }

    registerTool(tool: ITool) {
        if (this.tools.has(tool.name)) {
            this.logger.warn(`Tool ${tool.name} is already registered. Overwriting.`);
        }
        this.tools.set(tool.name, tool);
        this.logger.info(`Registered tool: ${tool.name}`);
    }

    getTool(name: string): ITool | undefined {
        return this.tools.get(name);
    }

    getAllTools(): ITool[] {
        return Array.from(this.tools.values());
    }

    getToolDefinitions(): ToolDefinition[] {
        return Array.from(this.tools.values()).map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        }));
    }

    async executeTool(name: string, params: any): Promise<ToolExecutionResult> {
        const tool = this.tools.get(name);
        if (!tool) {
            return {
                toolName: name,
                data: null,
                error: `Tool ${name} not found`
            };
        }

        try {
            this.logger.debug(`Executing tool ${name} with params: ${JSON.stringify(params)}`);

            // Wrap execution in circuit breaker
            const data = await this.circuitBreaker.execute(async () => {
                return await tool.execute(params);
            });

            return {
                toolName: name,
                data
            };
        } catch (error: any) {
            this.logger.error(`Error executing tool ${name}: ${error.message}`);
            return {
                toolName: name,
                data: null,
                error: error.message
            };
        }
    }
}

export default new ToolRegistry();
