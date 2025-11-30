import { ITool, ToolDefinition, ToolExecutionResult } from './tool.interface.js';
import { createContextualLogger } from '../../core/logger/logger.js';
import { Logger } from 'winston';

class ToolRegistry {
    private tools: Map<string, ITool> = new Map();
    private logger: Logger;

    constructor() {
        this.logger = createContextualLogger({ module: 'ToolRegistry' });
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
            const data = await tool.execute(params);
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
