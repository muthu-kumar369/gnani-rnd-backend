// gnani-rnd-backend/src/core/llm/llm.interface.ts

export interface GenerateOptions {
    temperature?: number;
    maxTokens?: number;
    stopSequences?: string[];
    stream?: boolean;
}

export interface LLMResponse {
    text: string;
    finishReason: 'stop' | 'length' | 'tool_call';
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export interface ToolCall {
    name: string;
    parameters: Record<string, any>;
}

export interface Tool {
    name: string;
    description: string;
    parameters: Record<string, any>;
    execute: (params: any) => Promise<any>;
}

export interface LLMProvider {
    name: string;

    // Basic generation
    generate(prompt: string, options?: GenerateOptions): AsyncIterableIterator<string>;

    // Generation with tools (function calling)
    generateWithTools(
        prompt: string,
        tools: Tool[],
        options?: GenerateOptions
    ): AsyncIterableIterator<LLMResponse>;

    // Capabilities
    supportsFunctionCalling: boolean;
    maxContextLength: number;

    // Health check
    isAvailable(): Promise<boolean>;
}
