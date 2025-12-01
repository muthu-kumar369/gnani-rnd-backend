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

export interface ITool {
    name: string;
    description: string;
    parameters: ToolParameter[];

    /**
     * Execute the tool with the given parameters
     */
    execute(params: any): Promise<any>;

    /**
     * Optional: Check if this tool is relevant for the query (heuristic)
     */
    isRelevant?(query: string): boolean;
}
