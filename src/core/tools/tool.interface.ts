// src/core/tools/tool.interface.ts
// Stage 13: Enhanced tool interface
export enum ToolCategory {
    SYSTEM = 'SYSTEM',
    WEB = 'WEB',
    FILE = 'FILE',
    COMMUNICATION = 'COMMUNICATION',
    PRODUCTIVITY = 'PRODUCTIVITY',
    CUSTOM = 'CUSTOM'
}

export interface ToolMetadata {
    name: string;
    description: string;
    category: ToolCategory;
    version: string;
    author?: string;
    tags?: string[];
    requiredPermissions?: string[];
}

export interface ToolParameter {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description: string;
    required: boolean;
    default?: any;
    validation?: (value: any) => boolean;
}

export interface ToolResult {
    success: boolean;
    data?: any;
    error?: string;
    metadata?: Record<string, any>;
    executionTime?: number;
}

export interface ITool {
    metadata: ToolMetadata;
    parameters: ToolParameter[];

    /**
     * Execute the tool with given parameters
     */
    execute(params: Record<string, any>): Promise<ToolResult>;

    /**
     * Validate parameters before execution
     */
    validate(params: Record<string, any>): boolean;

    /**
     * Get JSON schema for the tool (for LLM function calling)
     */
    getSchema(): object;
}
