// src/core/tools/base-tool.ts
// Stage 13: Base tool class with validation
import { ITool, ToolMetadata, ToolParameter, ToolResult } from './tool.interface.js';

export abstract class BaseTool implements ITool {
    abstract metadata: ToolMetadata;
    abstract parameters: ToolParameter[];

    abstract execute(params: Record<string, any>): Promise<ToolResult>;

    /**
     * Validate parameters against schema
     */
    validate(params: Record<string, any>): boolean {
        // Check required parameters
        for (const param of this.parameters) {
            if (param.required && !(param.name in params)) {
                return false;
            }

            // Type validation
            if (param.name in params) {
                const value = params[param.name];
                if (!this.validateType(value, param.type)) {
                    return false;
                }

                // Custom validation
                if (param.validation && !param.validation(value)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Validate value type
     */
    private validateType(value: any, type: string): boolean {
        switch (type) {
            case 'string':
                return typeof value === 'string';
            case 'number':
                return typeof value === 'number';
            case 'boolean':
                return typeof value === 'boolean';
            case 'object':
                return typeof value === 'object' && !Array.isArray(value);
            case 'array':
                return Array.isArray(value);
            default:
                return true;
        }
    }

    /**
     * Get JSON schema for LLM function calling
     */
    getSchema(): object {
        return {
            name: this.metadata.name,
            description: this.metadata.description,
            category: this.metadata.category,
            parameters: {
                type: 'object',
                properties: this.parameters.reduce((acc, p) => {
                    acc[p.name] = {
                        type: p.type,
                        description: p.description
                    };
                    if (p.default !== undefined) {
                        acc[p.name].default = p.default;
                    }
                    return acc;
                }, {} as Record<string, any>),
                required: this.parameters.filter(p => p.required).map(p => p.name)
            }
        };
    }

    /**
     * Helper to create successful result
     */
    protected success(data?: any, metadata?: Record<string, any>): ToolResult {
        return {
            success: true,
            data,
            metadata
        };
    }

    /**
     * Helper to create error result
     */
    protected error(error: string, metadata?: Record<string, any>): ToolResult {
        return {
            success: false,
            error,
            metadata
        };
    }
}
