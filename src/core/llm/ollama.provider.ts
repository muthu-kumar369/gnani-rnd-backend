// gnani-rnd-backend/src/core/llm/ollama.provider.ts

import { LLMProvider, GenerateOptions, LLMResponse, Tool } from './llm.interface.js';
import axios from 'axios';
import logger from '../logger/logger.js';

export interface OllamaConfig {
    baseUrl?: string;
    model?: string;
}

export class OllamaProvider implements LLMProvider {
    name = 'ollama';
    private baseUrl: string;
    private model: string;

    constructor(config: OllamaConfig = {}) {
        this.baseUrl = config.baseUrl || process.env.LLM_SERVER_URL || 'http://localhost:11434';
        this.model = config.model || process.env.LLM_MODEL || 'llama3.1:8b';

        logger.info('OllamaProvider initialized', { baseUrl: this.baseUrl, model: this.model });
    }

    async *generate(prompt: string, options?: GenerateOptions): AsyncIterableIterator<LLMResponse> {
        try {
            logger.info(`Ollama Request: URL=${this.baseUrl}/api/generate, Model=${this.model}`);
            logger.info(`Ollama Prompt Preview: ${prompt.substring(0, 100)}...`);

            const response = await axios.post(
                `${this.baseUrl}/api/generate`,
                {
                    model: this.model,
                    prompt,
                    stream: options?.stream !== false,
                    options: {
                        temperature: options?.temperature || 0.7,
                        num_predict: options?.maxTokens || 200,
                        stop: options?.stopSequences
                    }
                },
                {
                    responseType: 'stream',
                    timeout: 30000 // 30 second timeout
                }
            );

            let buffer = '';

            for await (const chunk of response.data) {
                buffer += chunk.toString();
                const lines = buffer.split('\n');
                // Keep the last line in the buffer as it might be incomplete
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;

                    try {
                        const data = JSON.parse(line);

                        const responseObj: LLMResponse = {
                            text: data.response || '',
                            finishReason: data.done ? 'stop' : 'length'
                        };

                        if (data.done && data.prompt_eval_count && data.eval_count) {
                            responseObj.usage = {
                                promptTokens: data.prompt_eval_count,
                                completionTokens: data.eval_count,
                                totalTokens: data.prompt_eval_count + data.eval_count
                            };
                        }

                        if (data.response || data.done) {
                            yield responseObj;
                        }

                        if (data.done) return;
                    } catch (parseError: any) {
                        logger.warn('Failed to parse Ollama chunk line', { line, error: parseError.message });
                    }
                }
            }
        } catch (error: any) {
            logger.error('Ollama generation failed', {
                error: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                url: `${this.baseUrl}/api/generate`,
                model: this.model
            });
            throw new Error(`Ollama generation failed: ${error.message}`);
        }
    }

    async *generateWithTools(
        prompt: string,
        tools: Tool[],
        options?: GenerateOptions
    ): AsyncIterableIterator<LLMResponse> {
        // Ollama supports function calling via system prompt
        const systemPrompt = this.buildToolPrompt(tools);
        const fullPrompt = `${systemPrompt}\n\n${prompt}`;

        let fullText = '';
        for await (const chunk of this.generate(fullPrompt, options)) {
            fullText += chunk.text;
            yield {
                text: chunk.text,
                finishReason: 'stop',
                usage: chunk.usage
            };
        }

        // Check if response contains tool call
        if (fullText.includes('TOOL_CALL:')) {
            yield {
                text: fullText,
                finishReason: 'tool_call'
            };
        }
    }

    supportsFunctionCalling = true;
    maxContextLength = 8192;

    async isAvailable(): Promise<boolean> {
        try {
            await axios.get(`${this.baseUrl}/api/tags`, { timeout: 5000 });
            return true;
        } catch (error) {
            logger.warn('Ollama is not available', { baseUrl: this.baseUrl });
            return false;
        }
    }

    private buildToolPrompt(tools: Tool[]): string {
        const toolDescriptions = tools.map(t =>
            `- ${t.name}: ${t.description}\n  Parameters: ${JSON.stringify(t.parameters)}`
        ).join('\n');

        return `You have access to the following tools:\n${toolDescriptions}\n\nTo use a tool, respond with: TOOL_CALL: {"name": "tool_name", "parameters": {...}}`;
    }

    // Getter for model name (useful for logging/debugging)
    getModel(): string {
        return this.model;
    }
}
