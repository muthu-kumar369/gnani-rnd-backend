// src/services/llmService.ts
import axios from 'axios';
import { createContextualLogger } from '../../core/logger/logger.js';
import metrics from '../../core/monitoring/metrics.js';
import auditService from '../../core/logger/audit.service.js';
import latencyMonitor from '../../core/monitoring/latency.monitor.js';
import {
    LLM_SERVER_URL,
    LLM_MODEL_PATH,
    LLM_API_KEY,
    LLM_MAX_TOKENS,
    LLM_TEMPERATURE,
    LLM_STREAMING_ENABLED
} from '../../config/env.config.js';
import { Logger } from 'winston';

import { CircuitBreaker } from '../../core/reliability/circuit-breaker.js';
import { retryWithBackoff } from '../../utils/retry.js';
import crypto from 'crypto';
import redis from '../../config/redis.config.js';
import { getModelConfig, DEFAULT_MODEL } from '../../config/llm.config.js';
import tokenCounterService, { TokenUsage } from './token-counter.service.js';

class LlmService {
    private logger: Logger;
    private llmApiUrl: string;
    private circuitBreaker: CircuitBreaker;

    constructor() {
        this.logger = createContextualLogger({ module: 'LlmService' });
        this.llmApiUrl = LLM_SERVER_URL;

        // Initialize Circuit Breaker
        this.circuitBreaker = new CircuitBreaker('LLM_API', {
            failureThreshold: 5,
            resetTimeoutMs: 30000, // 30 seconds
            requestTimeoutMs: 60000 // 60 seconds
        });

        this.logger.info('LlmService initialized with Circuit Breaker.');
        auditService.logEvent('LLM_SERVICE_INIT', null, null, {}, 'success');
    }

    private generateCacheKey(prompt: any): string {
        const normalized = JSON.stringify({
            query: prompt.current_user_query,
            intent: prompt.classified_intent,
            system: prompt.system_message?.substring(0, 100) // First 100 chars
        });
        return `llm:${crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16)}`;
    }

    /**
     * Get model path based on user preference with fallback to default
     * @param preferredModel - User's preferred model ID
     * @returns Model path to use for LLM requests
     */
    private getModelPath(preferredModel?: string): string {
        if (!preferredModel) {
            return LLM_MODEL_PATH; // Use env default
        }

        const modelConfig = getModelConfig(preferredModel);
        this.logger.debug(`Using model: ${modelConfig.modelName} (requested: ${preferredModel})`);
        return modelConfig.modelName;
    }

    async getToolDecision(decisionPrompt: any, preferredModel?: string): Promise<{ needs_tool: boolean, tool_name?: string, parameters?: any }> {
        const sessionId = decisionPrompt.session_id;
        this.logger.debug(`Getting tool decision for session ${sessionId}`);

        try {
            const headers: any = {
                'Content-Type': 'application/json',
            };
            if (LLM_API_KEY && LLM_API_KEY !== 'your_llm_api_key_here') {
                headers['Authorization'] = `Bearer ${LLM_API_KEY}`;
            }

            // Format prompt for decision (simple system + user)
            const promptText = `System: ${decisionPrompt.system_message}\n\nUser: ${decisionPrompt.user_query}`;

            const requestBody = {
                model: this.getModelPath(preferredModel),
                prompt: promptText,
                max_tokens: 200, // Short response expected
                temperature: 0.1, // Low temp for deterministic JSON
                stream: false,
                stop: ["User:", "System:"],
                // response_format: { type: "json_object" } // Uncomment if model supports it
            };

            const response = await axios.post(this.llmApiUrl + '/api/generate', requestBody, { headers });
            let content = response.data.response;

            // Extract JSON from content
            // 1. Try to find markdown code block first
            const markdownMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (markdownMatch) {
                content = markdownMatch[1];
            } else {
                // 2. Fallback: Try to find the first '{' and the last '}'
                const firstBrace = content.indexOf('{');
                const lastBrace = content.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    content = content.substring(firstBrace, lastBrace + 1);
                }
            }

            try {
                const decision = JSON.parse(content);
                this.logger.info(`Tool decision for session ${sessionId}: ${JSON.stringify(decision)}`);
                console.log(`[LlmService] Tool Decision Parsed: ${JSON.stringify(decision)}`);
                return decision;
            } catch (e) {
                this.logger.warn(`Failed to parse tool decision JSON: ${content}`);
                console.warn(`[LlmService] Failed to parse JSON: ${content}`);
                return { needs_tool: false };
            }

        } catch (error: any) {
            this.logger.error(`Error getting tool decision: ${error.message}`);
            console.error(`[LlmService] Error getting tool decision: ${error.message}`);
            return { needs_tool: false };
        }
    }

    /**
     * Generate a concise conversation title based on conversation context
     * @param conversationContext - String containing first 2-3 messages
     * @returns Promise<string> - Generated title (max 60 characters)
     */
    async generateTitle(conversationContext: string): Promise<string> {
        this.logger.debug('Generating conversation title', {
            contextLength: conversationContext.length
        });

        try {
            const headers: any = {
                'Content-Type': 'application/json',
            };
            if (LLM_API_KEY && LLM_API_KEY !== 'your_llm_api_key_here') {
                headers['Authorization'] = `Bearer ${LLM_API_KEY}`;
            }

            // Specialized prompt for title generation
            const systemPrompt = `You are a title generator. Given a conversation excerpt, generate a concise, descriptive title (max 60 characters).
The title should capture the main topic or question.
Output only the title, nothing else. Do not use quotes.`;

            const userPrompt = `Conversation:
${conversationContext}

Generate a title:`;

            const promptText = `${systemPrompt}\n\n${userPrompt}`;

            const requestBody = {
                model: this.getModelPath(), // Use default for title generation
                prompt: promptText,
                max_tokens: 20, // Short response for title
                temperature: 0.3, // Low temperature for consistency
                stream: false,
                stop: ["\n", "User:", "Assistant:"]
            };

            const response = await retryWithBackoff(
                () => axios.post(this.llmApiUrl + '/api/generate', requestBody, { headers }),
                { maxRetries: 2, baseDelayMs: 500 }, // Only 2 retries for title generation
                'Title Generation'
            );

            let title = response.data.response.trim();

            // Clean up the title
            // Remove surrounding quotes if present
            title = title.replace(/^["']|["']$/g, '');

            // Truncate to 60 characters if needed
            if (title.length > 60) {
                title = title.substring(0, 57) + '...';
            }

            // Fallback if title is empty or too short
            if (!title || title.length < 3) {
                this.logger.warn('Generated title too short, using fallback');
                return 'New Conversation';
            }

            this.logger.info('Successfully generated title', { title });
            metrics.incLlmCall('title-generation', 'title_generation', 'success');

            return title;

        } catch (error: any) {
            this.logger.error(`Error generating title: ${error.message}`);
            metrics.incLlmCall('title-generation', 'title_generation', 'failure');
            // Return fallback title on error
            return 'New Conversation';
        }
    }

    async getLlmResponse(structuredPrompt: any, onPartialResponse: ((response: { text: string }) => Promise<void> | void) | null = null, preferredModel?: string): Promise<{ text: string, action: any, tokenUsage?: TokenUsage }> {
        const sessionId = structuredPrompt.session_id;
        const userId = structuredPrompt.user_id;
        this.logger.debug(`Sending prompt to LLM for session ${sessionId}: ${JSON.stringify(structuredPrompt)}`);
        auditService.logLlmEvent(userId, sessionId, structuredPrompt, null, 'info', null);

        // NEW: Check cache
        const cacheKey = this.generateCacheKey(structuredPrompt);
        try {
            const cached = await redis.get(cacheKey);
            if (cached) {
                this.logger.info('LLM cache hit', { cacheKey });
                metrics.incrementLLMCacheHit();
                const response = JSON.parse(cached);

                // Stream cached response if callback provided
                if (onPartialResponse) {
                    await onPartialResponse({ type: 'complete_response', text: response.text } as any);
                }

                return response;
            }
            metrics.incrementLLMCacheMiss();
        } catch (cacheError: any) {
            this.logger.warn(`Cache read error: ${cacheError.message}`);
        }

        try {
            const headers: any = {
                'Content-Type': 'application/json',
            };
            if (LLM_API_KEY && LLM_API_KEY !== 'your_llm_api_key_here') {
                headers['Authorization'] = `Bearer ${LLM_API_KEY}`;
            }

            const formattedPrompt = this._formatPromptForLLM(structuredPrompt);
            this.logger.debug(`Crafted prompt for LLM: ${JSON.stringify(formattedPrompt)}`);

            let requestBody: any = {
                model: this.getModelPath(preferredModel),
                max_tokens: LLM_MAX_TOKENS,
                temperature: 0.7,
                top_p: 0.9,
                frequency_penalty: 0.3,  // Reduced from 1.5 - gentle repetition control
                presence_penalty: 0.2,   // Reduced from 0.8 - slight topic diversity
                stop: [
                    "User:",
                    "System:",
                    "Assistant:",
                    "\nUser:",
                    "\nAssistant:",
                    "Human:",
                    "\nHuman:"
                ],
                stream: LLM_STREAMING_ENABLED,
            };

            if (structuredPrompt.image_data) {
                // Multi-modal request
                requestBody.prompt = null; // Clear simple prompt
                requestBody.messages = [
                    {
                        role: "user",
                        content: formattedPrompt,
                        images: [structuredPrompt.image_data.data] // Assuming base64 string
                    }
                ];
                // Adjust for specific API if needed (e.g. Ollama uses 'images' array in message)
                // If using Gemini directly, structure might be different.
                // Assuming standard Ollama/OpenAI-vision compatible proxy.
            } else {
                // Text-only request
                requestBody.prompt = formattedPrompt;
            }

            return await this.circuitBreaker.execute(async () => {
                let llmOutput = '';
                let action = null;
                let tokenUsage: TokenUsage | undefined;

                // Start LLM latency tracking
                latencyMonitor.startTimer(sessionId, 'llm_total');
                latencyMonitor.startTimer(sessionId, 'llm_ttft');
                let firstTokenReceived = false;

                if (LLM_STREAMING_ENABLED && onPartialResponse) {
                    // Send a debug chunk to verify pipeline
                    await onPartialResponse({ type: 'debug', text: 'LLM_STREAM_START' } as any);

                    const response = await retryWithBackoff(
                        () => axios.post(this.llmApiUrl + '/api/generate', requestBody, { headers, responseType: 'stream' }),
                        { maxRetries: 3, baseDelayMs: 1000 },
                        'LLM Stream Request'
                    );

                    // Text Stabilization Buffer
                    let stabilizationBuffer = '';

                    await new Promise<void>((resolve, reject) => {
                        response.data.on('data', async (chunk: any) => {
                            try {
                                const chunkData = JSON.parse(chunk.toString());

                                // Capture token usage from final chunk
                                if (chunkData.done && chunkData.prompt_eval_count && chunkData.eval_count) {
                                    tokenUsage = tokenCounterService.createUsage(
                                        chunkData.prompt_eval_count,
                                        chunkData.eval_count,
                                        requestBody.model
                                    );
                                }

                                if (chunkData.response) {
                                    const newContent = chunkData.response;

                                    // Track Time To First Token (TTFT)
                                    if (!firstTokenReceived && newContent.trim().length > 0) {
                                        latencyMonitor.endTimer(sessionId, 'llm_ttft');
                                        firstTokenReceived = true;
                                    }

                                    // Validate: Check for malformed/garbage responses
                                    const isMalformed = /^[\.\*\s\?\!,;:]{1,3}$/.test(newContent.trim());

                                    // Detect repetitive words (e.g., "it it it it")
                                    const words = newContent.trim().split(/\s+/);
                                    const isRepetitive = words.length > 2 && words.every((w: string, i: number) => i === 0 || w === words[0]);

                                    if (isMalformed || isRepetitive) {
                                        this.logger.warn(`Detected malformed/repetitive LLM chunk: "${newContent}". Proceeding anyway for debug.`);
                                        // return; // DISABLED FILTER FOR DEBUGGING
                                    }

                                    let delta = '';

                                    // Smart Delta Detection
                                    if (llmOutput.length > 0 && newContent.startsWith(llmOutput)) {
                                        delta = newContent.substring(llmOutput.length);
                                        llmOutput = newContent;
                                    } else if (llmOutput.length === 0) {
                                        delta = newContent;
                                        llmOutput = newContent;
                                    } else {
                                        // Fallback for non-matching delta
                                        delta = newContent;
                                        llmOutput += newContent;
                                    }

                                    if (delta.length > 0) {
                                        // Add to stabilization buffer
                                        stabilizationBuffer += delta;

                                        // Check if we have a complete word/sentence (ends with space or punctuation)
                                        // We look for the LAST delimiter to split safe vs unsafe text
                                        const lastDelimiterIndex = stabilizationBuffer.search(/[\s\.\,\!\?\;\:]+[^\s\.\,\!\?\;\:]*$/);

                                        if (lastDelimiterIndex !== -1) {
                                            // We have at least one stable word
                                            // "start the mu" -> "start the " is stable, "mu" is partial
                                            // Actually, regex above finds the START of the last non-delimiter group?
                                            // Let's use a simpler approach: split by delimiters, keep the last part if it doesn't end with delimiter

                                            // If buffer ends with delimiter, everything is stable
                                            if (/[\s\.\,\!\?\;\:]$/.test(stabilizationBuffer)) {
                                                const finalChunk = stabilizationBuffer;
                                                stabilizationBuffer = '';
                                                console.log(`[LLM Service] Sending FINAL: "${finalChunk}"`);
                                                // @ts-ignore - Sending object instead of string
                                                await onPartialResponse({ type: 'final', text: finalChunk });
                                            } else {
                                                // Buffer does NOT end with delimiter (e.g. "start the mu")
                                                // Find the last delimiter
                                                const lastSpace = stabilizationBuffer.lastIndexOf(' ');
                                                // Also check for punctuation if space is not found or punctuation is later
                                                // For simplicity, let's just use space as the main stabilizer for words

                                                if (lastSpace !== -1) {
                                                    const stablePart = stabilizationBuffer.substring(0, lastSpace + 1);
                                                    const unstablePart = stabilizationBuffer.substring(lastSpace + 1);

                                                    stabilizationBuffer = unstablePart;

                                                    console.log(`[LLM Service] Sending FINAL: "${stablePart}"`);
                                                    // @ts-ignore
                                                    await onPartialResponse({ type: 'final', text: stablePart });

                                                    if (unstablePart.length > 0) {
                                                        console.log(`[LLM Service] Sending PARTIAL: "${unstablePart}"`);
                                                        // @ts-ignore
                                                        await onPartialResponse({ type: 'partial', text: unstablePart });
                                                    }
                                                } else {
                                                    // No space yet, just send partial
                                                    console.log(`[LLM Service] Sending PARTIAL: "${stabilizationBuffer}"`);
                                                    // @ts-ignore
                                                    await onPartialResponse({ type: 'partial', text: stabilizationBuffer });
                                                }
                                            }
                                        } else {
                                            // No delimiters at all, send as partial
                                            console.log(`[LLM Service] Sending PARTIAL: "${stabilizationBuffer}"`);
                                            // @ts-ignore
                                            await onPartialResponse({ type: 'partial', text: stabilizationBuffer });
                                        }
                                    }
                                }
                            } catch (e: any) {
                                this.logger.error(`Error parsing LLM streaming chunk: ${e.message}`);
                            }
                        });
                        response.data.on('end', async () => {
                            this.logger.debug('LLM streaming response ended.');

                            // Flush remaining buffer as final
                            if (stabilizationBuffer.length > 0) {
                                console.log(`[LLM Service] Flushing FINAL: "${stabilizationBuffer}"`);
                                // @ts-ignore
                                await onPartialResponse({ type: 'final', text: stabilizationBuffer });
                            }

                            console.log(`[LLM Service] Full Output: "${llmOutput}"`);

                            // End LLM total latency tracking
                            latencyMonitor.endTimer(sessionId, 'llm_total');

                            metrics.incLlmCall(sessionId, structuredPrompt.classified_intent, 'success');
                            auditService.logLlmEvent(userId, sessionId, structuredPrompt, { text: llmOutput }, 'success');
                            resolve();
                        });
                        response.data.on('error', (err: Error) => {
                            this.logger.error(`LLM streaming error for session ${sessionId}: ${err.message}`);
                            metrics.incLlmCall(sessionId, structuredPrompt.classified_intent, 'failure');
                            auditService.logLlmEvent(userId, sessionId, structuredPrompt, null, 'failure', err.message);
                            reject(new Error(`LLM streaming error: ${err.message}`));
                        });
                    });
                } else {
                    const response = await retryWithBackoff(
                        () => axios.post(this.llmApiUrl + '/api/generate', requestBody, { headers }),
                        { maxRetries: 3, baseDelayMs: 1000 },
                        'LLM Request'
                    );
                    llmOutput = response.data.response;

                    if (response.data.prompt_eval_count && response.data.eval_count) {
                        tokenUsage = tokenCounterService.createUsage(
                            response.data.prompt_eval_count,
                            response.data.eval_count,
                            requestBody.model
                        );
                    }

                    if (structuredPrompt.classified_intent === 'system_command' || structuredPrompt.classified_intent === 'utility_request') {
                        action = { action: 'OPEN_APP', app_name: 'Terminal' };
                    }
                    metrics.incLlmCall(sessionId, structuredPrompt.classified_intent, 'success');
                    auditService.logLlmEvent(userId, sessionId, structuredPrompt, { text: llmOutput, action }, 'success');
                }

                // NEW: Cache the response for 1 hour
                try {
                    await redis.setex(cacheKey, 3600, JSON.stringify({ text: llmOutput, action }));
                } catch (cacheError: any) {
                    this.logger.warn(`Cache write error: ${cacheError.message}`);
                }

                return { text: llmOutput, action, tokenUsage };
            });

        } catch (error: any) {
            this.logger.error(`Error calling LLM at ${this.llmApiUrl} for session ${sessionId}: ${error.message}`);
            metrics.incLlmCall(sessionId, structuredPrompt.classified_intent, 'failure');
            auditService.logLlmEvent(userId, sessionId, structuredPrompt, null, 'failure', error.message);
            return {
                text: "I'm sorry, I'm having trouble connecting to my brain right now. Please try again later.",
                action: null
            };
        }
    }

    private _formatPromptForLLM(structuredPrompt: any): string {
        let promptParts: string[] = [];

        // 1. Construct the System Message Block
        let systemBlock = `System: ${structuredPrompt.system_message}`;

        // Note: long_term_context is now embedded in system_message by context.engine
        // So we don't add it again here

        promptParts.push(systemBlock);

        // 2. Add Conversation History (limited to prevent context overload)
        if (structuredPrompt.conversation_history && structuredPrompt.conversation_history.length > 0) {
            // Limit to last 8 interactions (16 messages) to prevent overwhelming the context
            const maxInteractions = 8;
            const limitedHistory = structuredPrompt.conversation_history.slice(-maxInteractions);

            limitedHistory.forEach((interaction: any) => {
                if (interaction.query) {
                    promptParts.push(`User: ${interaction.query}`);
                }
                if (interaction.response) {
                    promptParts.push(`Assistant: ${interaction.response}`);
                }
            });
        }

        // 3. Add Current User Query with clear separation
        promptParts.push(`\n=== CURRENT INTERACTION ===`);
        promptParts.push(`User: ${structuredPrompt.current_user_query}`);
        promptParts.push(`Assistant:`);

        return promptParts.join('\n');
    }
}

export default new LlmService();
