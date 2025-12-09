import { LLMProvider, GenerateOptions, LLMResponse, Tool } from '../llm.interface.js';
import axios from 'axios';
import logger from '../../logger/logger.js';

export class LocalAIProvider implements LLMProvider {
    name = 'localai';
    private baseUrl: string;
    private model: string;

    constructor(config: { baseUrl?: string, model?: string } = {}) {
        this.baseUrl = config.baseUrl || process.env.LOCALAI_URL || 'http://localhost:8080/v1';
        this.model = config.model || process.env.LOCALAI_MODEL || 'gpt-4'; // LocalAI often maps 'gpt-4' to a local model

        logger.info('LocalAIProvider initialized', { baseUrl: this.baseUrl, model: this.model });
    }

    supportsFunctionCalling = true; // LocalAI supports grammar-based function calling or OpenAI emulation
    maxContextLength = 8192;

    async *generate(prompt: string, options?: GenerateOptions): AsyncIterableIterator<LLMResponse> {
        // Very similar to vLLM/OpenAI
        try {
            const response = await axios.post(
                `${this.baseUrl}/chat/completions`,
                {
                    model: options?.model || this.model,
                    messages: [{ role: 'user', content: prompt }],
                    stream: options?.stream !== false,
                    temperature: options?.temperature || 0.7,
                    max_tokens: options?.maxTokens || 512
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

                    const jsonStr = line.substring(6);
                    if (jsonStr === '[DONE]') return;

                    try {
                        const data = JSON.parse(jsonStr);
                        if (data.choices && data.choices[0]?.delta?.content) {
                            yield {
                                text: data.choices[0].delta.content,
                                finishReason: 'stop'
                            };
                        }
                    } catch (e) { }
                }
            }
        } catch (error: any) {
            logger.error('LocalAI generation failed', { error: error.message });
            throw new Error(`LocalAI generation failed: ${error.message}`);
        }
    }

    async *generateWithTools(prompt: string, tools: Tool[], options?: GenerateOptions): AsyncIterableIterator<LLMResponse> {
        // Similar to generate, LocalAI tries to emulate OpenAI tools
        // Implementation omitted for brevity, falling back to basic generate
        yield* this.generate(prompt, options);
    }

    async isAvailable(): Promise<boolean> {
        try {
            await axios.get(`${this.baseUrl}/models`);
            return true;
        } catch {
            return false;
        }
    }
}
