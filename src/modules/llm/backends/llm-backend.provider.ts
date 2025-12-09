import axios from 'axios';
import { createContextualLogger } from '../../../core/logger/logger.js';

export interface LLMBackendConfig {
    type: 'ollama' | 'llamacpp' | 'vllm' | 'localai';
    baseUrl: string;
    apiKey?: string;
    timeout?: number;
}

export interface LLMRequest {
    messages: Array<{ role: string; content: string }>;
    model: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
}

export interface LLMResponse {
    text: string;
    model: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

/**
 * Abstract base class for LLM backend providers
 */
export abstract class LLMBackendProvider {
    protected readonly logger = createContextualLogger({ module: this.constructor.name });

    constructor(protected readonly config: LLMBackendConfig) { }

    abstract generateCompletion(request: LLMRequest): Promise<LLMResponse>;
    abstract streamCompletion(request: LLMRequest): AsyncGenerator<string, void, unknown>;
    abstract listModels(): Promise<string[]>;
}

/**
 * Ollama backend provider
 */
export class OllamaProvider extends LLMBackendProvider {
    async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
        const response = await axios.post(
            `${this.config.baseUrl}/api/chat`,
            {
                model: request.model,
                messages: request.messages,
                stream: false,
                options: {
                    temperature: request.temperature || 0.7,
                    num_predict: request.maxTokens || 2000,
                },
            },
            { timeout: this.config.timeout || 60000 }
        );

        return {
            text: response.data.message.content,
            model: request.model,
            usage: {
                promptTokens: response.data.prompt_eval_count || 0,
                completionTokens: response.data.eval_count || 0,
                totalTokens: (response.data.prompt_eval_count || 0) + (response.data.eval_count || 0),
            },
        };
    }

    async *streamCompletion(request: LLMRequest): AsyncGenerator<string, void, unknown> {
        const response = await axios.post(
            `${this.config.baseUrl}/api/chat`,
            {
                model: request.model,
                messages: request.messages,
                stream: true,
                options: {
                    temperature: request.temperature || 0.7,
                },
            },
            {
                responseType: 'stream',
                timeout: this.config.timeout || 60000,
            }
        );

        for await (const chunk of response.data) {
            const lines = chunk.toString().split('\n').filter((line: string) => line.trim());
            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    if (data.message?.content) {
                        yield data.message.content;
                    }
                } catch (e) {
                    // Skip invalid JSON
                }
            }
        }
    }

    async listModels(): Promise<string[]> {
        const response = await axios.get(`${this.config.baseUrl}/api/tags`);
        return response.data.models.map((m: any) => m.name);
    }
}

/**
 * llama.cpp backend provider
 */
export class LlamaCppProvider extends LLMBackendProvider {
    async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
        // Convert messages to prompt
        const prompt = this.messagesToPrompt(request.messages);

        const response = await axios.post(
            `${this.config.baseUrl}/completion`,
            {
                prompt,
                temperature: request.temperature || 0.7,
                n_predict: request.maxTokens || 2000,
                stop: ['</s>', 'User:', 'Assistant:'],
            },
            { timeout: this.config.timeout || 60000 }
        );

        return {
            text: response.data.content,
            model: request.model,
            usage: {
                promptTokens: response.data.tokens_evaluated || 0,
                completionTokens: response.data.tokens_predicted || 0,
                totalTokens: (response.data.tokens_evaluated || 0) + (response.data.tokens_predicted || 0),
            },
        };
    }

    async *streamCompletion(request: LLMRequest): AsyncGenerator<string, void, unknown> {
        const prompt = this.messagesToPrompt(request.messages);

        const response = await axios.post(
            `${this.config.baseUrl}/completion`,
            {
                prompt,
                temperature: request.temperature || 0.7,
                stream: true,
            },
            {
                responseType: 'stream',
                timeout: this.config.timeout || 60000,
            }
        );

        for await (const chunk of response.data) {
            const lines = chunk.toString().split('\n').filter((line: string) => line.trim());
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.substring(6));
                        if (data.content) {
                            yield data.content;
                        }
                    } catch (e) {
                        // Skip invalid JSON
                    }
                }
            }
        }
    }

    async listModels(): Promise<string[]> {
        // llama.cpp typically runs a single model
        return [this.config.baseUrl.split('/').pop() || 'llama'];
    }

    private messagesToPrompt(messages: Array<{ role: string; content: string }>): string {
        return messages
            .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
            .join('\n') + '\nAssistant:';
    }
}

/**
 * vLLM backend provider
 */
export class VLLMProvider extends LLMBackendProvider {
    async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
        const response = await axios.post(
            `${this.config.baseUrl}/v1/chat/completions`,
            {
                model: request.model,
                messages: request.messages,
                temperature: request.temperature || 0.7,
                max_tokens: request.maxTokens || 2000,
            },
            {
                headers: this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {},
                timeout: this.config.timeout || 60000,
            }
        );

        return {
            text: response.data.choices[0].message.content,
            model: request.model,
            usage: {
                promptTokens: response.data.usage.prompt_tokens,
                completionTokens: response.data.usage.completion_tokens,
                totalTokens: response.data.usage.total_tokens,
            },
        };
    }

    async *streamCompletion(request: LLMRequest): AsyncGenerator<string, void, unknown> {
        const response = await axios.post(
            `${this.config.baseUrl}/v1/chat/completions`,
            {
                model: request.model,
                messages: request.messages,
                temperature: request.temperature || 0.7,
                stream: true,
            },
            {
                headers: this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {},
                responseType: 'stream',
                timeout: this.config.timeout || 60000,
            }
        );

        for await (const chunk of response.data) {
            const lines = chunk.toString().split('\n').filter((line: string) => line.trim());
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.substring(6);
                    if (data === '[DONE]') break;

                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices[0]?.delta?.content;
                        if (content) {
                            yield content;
                        }
                    } catch (e) {
                        // Skip invalid JSON
                    }
                }
            }
        }
    }

    async listModels(): Promise<string[]> {
        const response = await axios.get(`${this.config.baseUrl}/v1/models`, {
            headers: this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {},
        });
        return response.data.data.map((m: any) => m.id);
    }
}

/**
 * LocalAI backend provider
 */
export class LocalAIProvider extends LLMBackendProvider {
    async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
        const response = await axios.post(
            `${this.config.baseUrl}/v1/chat/completions`,
            {
                model: request.model,
                messages: request.messages,
                temperature: request.temperature || 0.7,
                max_tokens: request.maxTokens || 2000,
            },
            { timeout: this.config.timeout || 60000 }
        );

        return {
            text: response.data.choices[0].message.content,
            model: request.model,
            usage: response.data.usage || {
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
            },
        };
    }

    async *streamCompletion(request: LLMRequest): AsyncGenerator<string, void, unknown> {
        const response = await axios.post(
            `${this.config.baseUrl}/v1/chat/completions`,
            {
                model: request.model,
                messages: request.messages,
                temperature: request.temperature || 0.7,
                stream: true,
            },
            {
                responseType: 'stream',
                timeout: this.config.timeout || 60000,
            }
        );

        for await (const chunk of response.data) {
            const lines = chunk.toString().split('\n').filter((line: string) => line.trim());
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.substring(6);
                    if (data === '[DONE]') break;

                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices[0]?.delta?.content;
                        if (content) {
                            yield content;
                        }
                    } catch (e) {
                        // Skip invalid JSON
                    }
                }
            }
        }
    }

    async listModels(): Promise<string[]> {
        const response = await axios.get(`${this.config.baseUrl}/v1/models`);
        return response.data.data.map((m: any) => m.id);
    }
}

/**
 * Factory for creating LLM backend providers
 */
export class LLMBackendFactory {
    static createProvider(config: LLMBackendConfig): LLMBackendProvider {
        switch (config.type) {
            case 'ollama':
                return new OllamaProvider(config);
            case 'llamacpp':
                return new LlamaCppProvider(config);
            case 'vllm':
                return new VLLMProvider(config);
            case 'localai':
                return new LocalAIProvider(config);
            default:
                throw new Error(`Unsupported backend type: ${config.type}`);
        }
    }
}
