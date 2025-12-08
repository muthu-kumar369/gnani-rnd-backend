// src/core/tools/tool-registry.ts
// Stage 13: Tool registry for dynamic tool management
import { ITool, ToolCategory } from './tool.interface.js';
import { createContextualLogger } from '../logger/logger.js';
import { Logger } from 'winston';

export class ToolRegistry {
    private tools: Map<string, ITool> = new Map();
    private logger: Logger;

    constructor() {
        this.logger = createContextualLogger({ module: 'ToolRegistry' });
    }

    /**
     * Register a tool
     */
    register(tool: ITool): void {
        this.tools.set(tool.metadata.name, tool);
        this.logger.info(`Registered tool: ${tool.metadata.name}`, {
            category: tool.metadata.category,
            version: tool.metadata.version
        });
    }

    /**
     * Unregister a tool
     */
    unregister(toolName: string): void {
        this.tools.delete(toolName);
        this.logger.info(`Unregistered tool: ${toolName}`);
    }

    /**
     * Get tool by name
     */
    getTool(toolName: string): ITool | undefined {
        return this.tools.get(toolName);
    }

    /**
     * Get all registered tools
     */
    getAllTools(): ITool[] {
        return Array.from(this.tools.values());
    }

    /**
     * Get tools by category
     */
    getToolsByCategory(category: ToolCategory): ITool[] {
        return this.getAllTools().filter(t => t.metadata.category === category);
    }

    /**
     * Get tools by tag
     */
    getToolsByTag(tag: string): ITool[] {
        return this.getAllTools().filter(t =>
            t.metadata.tags?.includes(tag)
        );
    }

    /**
     * Get all tool schemas for LLM function calling
     */
    getToolSchemas(): object[] {
        return this.getAllTools().map(t => t.getSchema());
    }

    /**
     * Check if user has permission to use tool
     */
    hasPermission(toolName: string, userPermissions: string[]): boolean {
        const tool = this.getTool(toolName);
        if (!tool || !tool.metadata.requiredPermissions) {
            return true;
        }

        return tool.metadata.requiredPermissions.every(p =>
            userPermissions.includes(p)
        );
    }

    /**
     * Get tool count
     */
    getToolCount(): number {
        return this.tools.size;
    }

    /**
     * Check if tool exists
     */
    hasTool(toolName: string): boolean {
        return this.tools.has(toolName);
    }
}

export default new ToolRegistry();
