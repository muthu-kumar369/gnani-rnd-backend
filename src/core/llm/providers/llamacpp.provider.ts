import { LLMProvider, GenerateOptions, LLMResponse, Tool } from '../llm.interface.js';
import axios from 'axios';
import logger from '../../logger/logger.js';

export class LlamaCppProvider implements LLMProvider {
    name = 'llamacpp';
    private baseUrl: string;

    constructor(config: { baseUrl?: string } = {}) {
        this.baseUrl = config.baseUrl || process.env.LLAMACPP_URL || 'http://localhost:8080';
        logger.info('LlamaCppProvider initialized', { baseUrl: this.baseUrl });
    }

    supportsFunctionCalling = false; // LlamaCpp raw support varies, assuming false for basic implementation
    maxContextLength = 4096;

    async *generate(prompt: string, options?: GenerateOptions): AsyncIterableIterator<LLMResponse> {
        try {
            logger.debug(`LlamaCpp Request: ${this.baseUrl}/completion`);

            const response = await axios.post(
                `${this.baseUrl}/completion`,
                {
                    prompt,
                    stream: options?.stream !== false,
                    temperature: options?.temperature || 0.7,
                    n_predict: options?.maxTokens || 512,
                    stop: options?.stopSequences || [],
                    // LlamaCpp specific options
                    cache_prompt: true
                },
                {
                    responseType: 'stream',
                    timeout: 60000
                }
            );

            let buffer = '';

            for await (const chunk of response.data) {
                buffer += chunk.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim() || !line.startsWith('data: ')) continue;

                    const jsonStr = line.substring(6); // Remove "data: "
                    if (jsonStr === '[DONE]') return;

                    try {
                        const data = JSON.parse(jsonStr);
                        yield {
                            text: data.content,
                            finishReason: data.stop ? 'stop' : 'length'
                        };
                    } catch (e: any) {
                        logger.warn('Failed to parse LlamaCpp chunk', { error: e.message });
                    }
                }
            }

        } catch (error: any) {
            logger.error('LlamaCpp generation failed', { error: error.message });
            throw new Error(`LlamaCpp generation failed: ${error.message}`);
        }
    }

    async *generateWithTools(prompt: string, tools: Tool[], options?: GenerateOptions): AsyncIterableIterator<LLMResponse> {
        // Simple fallback: append tool definitions to prompt
        // Real implementation would use grammar-constrained sampling if LlamaCpp supports it
        const toolJson = JSON.stringify(tools.map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters
        })), null, 2);

        const systemPrompt = `You have access to tools. If useful, respond with a JSON object {"tool": "name", "parameters": {...}}.\nTools:\n${toolJson}\n\n`;
        const fullPrompt = `${systemPrompt}${prompt}`;

        yield* this.generate(fullPrompt, options);
    }

    async isAvailable(): Promise<boolean> {
        try {
            await axios.get(`${this.baseUrl}/health`);
            return true;
        } catch {
            return false;
        }
    }
}
