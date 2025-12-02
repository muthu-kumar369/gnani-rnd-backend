export interface ToolParameter {
    name: string;
    type: string;
    description: string;
    required: boolean;
    // Enhanced validation fields
    enum?: any[];
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    example?: string;
}

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: ToolParameter[];
}

export interface ToolExecutionResult {
    toolName: string;
    data: any;
    error?: string;
}

export interface ToolStatus {
    tool_name: string;
    status: 'starting' | 'running' | 'completed' | 'failed';
    progress: number;
    message: string;
    elapsed_ms: number;
}

export type ProgressCallback = (status: ToolStatus) => void;

export interface ITool {
    name: string;
    description: string;
    parameters: ToolParameter[];

    /**
     * Execute the tool with the given parameters
     */
    execute(params: any, onProgress?: (update: { progress: number; message: string }) => void): Promise<any>;

    /**
     * Optional: Check if this tool is relevant for the query (heuristic)
     */
    isRelevant?(query: string): boolean;
}
