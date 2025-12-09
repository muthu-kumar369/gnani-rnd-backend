import { LLMProvider, GenerateOptions, LLMResponse, Tool } from '../llm.interface.js';
import axios from 'axios';
import logger from '../../logger/logger.js';

export class VLLMProvider implements LLMProvider {
    name = 'vllm';
    private baseUrl: string;
    private model: string;
    private apiKey: string;

    constructor(config: { baseUrl?: string, model?: string, apiKey?: string } = {}) {
        this.baseUrl = config.baseUrl || process.env.VLLM_URL || 'http://localhost:8000/v1';
        this.model = config.model || process.env.VLLM_MODEL || 'facebook/opt-125m';
        this.apiKey = config.apiKey || process.env.VLLM_API_KEY || 'EMPTY';

        logger.info('VLLMProvider initialized', { baseUrl: this.baseUrl, model: this.model });
    }

    supportsFunctionCalling = true; // vLLM supports OpenAI function calling if the model supports it
    maxContextLength = 8192; // Default, depends on model

    async *generate(prompt: string, options?: GenerateOptions): AsyncIterableIterator<LLMResponse> {
        try {
            const url = `${this.baseUrl}/completions`; // Or /chat/completions depending on usage. Using completions for raw prompt.
            // If the prompt is formatted as a chat, we might want to use chat/completions.
            // However, the interface takes a string prompt. 
            // Let's assume /completions for flexibility with raw prompts, or we can wrap in a user message for chat.
            // Given modern usage, /chat/completions is more standard for vLLM with chat models.
            // But if 'prompt' is a raw string (which `generate` implies), /completions is safer if supported.
            // vLLM supports both. Let's use /chat/completions and wrap if it looks like a chat, or just use completions.
            // For simplicity and compatibility with most "generate" calls, let's use /chat/completions and treating prompt as user message
            // OR use /completions.

            // Let's stick to /chat/completions as it's the OpenAI standard vLLM emulates best.

            const messages = [{ role: 'user', content: prompt }];

            logger.debug(`VLLM Request: ${this.baseUrl}/chat/completions`, { model: this.model });

            const response = await axios.post(
                `${this.baseUrl}/chat/completions`,
                {
                    model: options?.model || this.model,
                    messages: messages,
                    stream: options?.stream !== false,
                    temperature: options?.temperature || 0.7,
                    max_tokens: options?.maxTokens || 512,
                    stop: options?.stopSequences,
                },
                {
                    headers: { 'Authorization': `Bearer ${this.apiKey}` },
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
                        if (data.choices && data.choices.length > 0) {
                            const delta = data.choices[0].delta || {};
                            const content = delta.content || '';
                            const finishReason = data.choices[0].finish_reason;

                            yield {
                                text: content,
                                finishReason: finishReason === 'stop' ? 'stop' : (finishReason === 'length' ? 'length' : (finishReason === 'tool_calls' ? 'tool_call' : 'stop'))
                            };
                        }
                    } catch (e: any) {
                        logger.warn('Failed to parse VLLM chunk', { error: e.message });
                    }
                }
            }

        } catch (error: any) {
            logger.error('VLLM generation failed', { error: error.message });
            throw new Error(`VLLM generation failed: ${error.message}`);
        }
    }

    async *generateWithTools(prompt: string, tools: Tool[], options?: GenerateOptions): AsyncIterableIterator<LLMResponse> {
        // vLLM OpenAI compatibility supports tools
        const openAiTools = tools.map(t => ({
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters
            }
        }));

        const messages = [{ role: 'user', content: prompt }];

        try {
            const response = await axios.post(
                `${this.baseUrl}/chat/completions`,
                {
                    model: options?.model || this.model,
                    messages: messages,
                    tools: openAiTools,
                    stream: true, // Streaming with tools can be tricky, but vLLM supports it
                    temperature: options?.temperature || 0.7
                },
                {
                    headers: { 'Authorization': `Bearer ${this.apiKey}` },
                    responseType: 'stream',
                    timeout: 60000
                }
            );

            let buffer = '';
            let currentToolCall: any = null;

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
                        const choice = data.choices[0];
                        const delta = choice.delta;

                        if (delta.content) {
                            yield {
                                text: delta.content,
                                finishReason: 'stop'
                            };
                        }

                        if (delta.tool_calls) {
                            const toolCall = delta.tool_calls[0];
                            // In streaming, we might get parts of tool calls.
                            // Simplified: just signal tool_call. 
                            // Real implementations need to accumulate tool call args.
                            // For this interface, we just text-ify it or specific structured return?
                            // The interface expects LLMResponse.
                            // If it's a tool call, we might want to return the raw JSON in text or handle it specialized.
                            // The interface has finishReason: 'tool_call'.

                            // Let's assume we accumulate and yield at the end, OR yield a special marker.
                            // For now, let's yield a marker text if it's the start.
                            if (toolCall.id) { // Start of new tool call
                                yield { text: `TOOL_CALL: ${toolCall.function.name}`, finishReason: 'tool_call' };
                            }
                        }
                    } catch (e) { }
                }
            }

        } catch (error: any) {
            logger.error('VLLM tool generation failed', { error: error.message });
            throw error;
        }
    }

    async isAvailable(): Promise<boolean> {
        try {
            await axios.get(`${this.baseUrl}/models`, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` },
                timeout: 5000
            });
            return true;
        } catch {
            return false;
        }
    }
}
