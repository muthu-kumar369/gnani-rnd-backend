// src/modules/session/llm.executor.ts
import { createContextualLogger } from '../../core/logger/logger.js';
import { llmManager } from '../../core/llm/llm.manager.js';
import toolRegistry from '../tools/tool.registry.js';
import contextEngine from '../context/context.engine.js';
import { Logger } from 'winston';
import { withRetry, isRetryableError } from '../../shared/utils/retry.js';
import { LLMError } from '../../shared/errors/error-types.js';
import metrics from '../../core/monitoring/metrics.js';
import llmCache from '../../core/cache/llm-cache.service.js';
import FEATURE_FLAGS from '../../config/feature-flags.js';

interface LLMResponse {
    text: string;
    toolCalls?: any[];
    tokenUsage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export class LLMExecutor {
    private logger: Logger;
    private MAX_TURNS = 5;

    constructor() {
        this.logger = createContextualLogger({ module: 'LLMExecutor' });
    }

    async generate(
        context: any,
        onChunk?: (chunk: string) => Promise<void> | void
    ): Promise<LLMResponse> {
        return withRetry(
            async () => this.generateInternal(context, onChunk),
            {
                maxRetries: 3,
                initialDelay: 1000,
                shouldRetry: isRetryableError
            }
        );
    }

    private async generateInternal(
        context: any,
        onChunk?: (chunk: string) => Promise<void> | void
    ): Promise<LLMResponse> {
        try {
            // Month-3: Check LLM cache first
            if (FEATURE_FLAGS.ENABLE_LLM_CACHE) {
                const cached = await llmCache.get(context.transcript, context);
                if (cached) {
                    this.logger.info('Using cached LLM response');

                    // Stream cached response if callback provided
                    if (onChunk) {
                        await onChunk(cached);
                    }

                    return { text: cached };
                }
            }

            // Get available tools
            const toolDefinitions = toolRegistry.getToolDefinitions();

            // Build initial prompt with tools
            let currentPrompt = await contextEngine.buildLLMPrompt(
                '', // sessionId not needed here as context already built
                context.userId || '',
                { cleanedText: context.transcript, intent: 'general' },
                toolDefinitions
            );

            let fullResponse = '';
            let turnCount = 0;

            // Month-2: Track LLM latency
            const llmStartTime = Date.now();
            let tokenCount = 0;

            this.logger.info('Starting Re-Act loop');

            // Re-Act loop for tool execution
            while (turnCount < this.MAX_TURNS) {
                turnCount++;
                this.logger.info(`Re-Act Turn ${turnCount}/${this.MAX_TURNS}`);
                this.logger.info(`Current Provider: ${llmManager.currentProvider?.name || 'unknown'}`);

                // Generate LLM response
                fullResponse = '';

                // Serialize prompt if it's an object (from contextEngine)
                let promptString = '';
                if (typeof currentPrompt === 'object') {
                    const p = currentPrompt as any;
                    // Construct a single string prompt from the components
                    promptString = `${p.system_message}\n\n`;

                    // Add conversation history
                    if (Array.isArray(p.conversation_history)) {
                        for (const msg of p.conversation_history) {
                            promptString += `${msg.query}\n${msg.response}\n\n`;
                        }
                    }

                    // Add current query
                    promptString += `User: ${p.current_user_query}\nAssistant:`;
                } else {
                    promptString = currentPrompt as string;
                }

                const stream = llmManager.generate(promptString, {
                    stream: true,
                    temperature: 0.7
                });

                let finalUsage;

                for await (const chunk of stream) {
                    fullResponse += chunk.text;
                    if (chunk.usage) {
                        finalUsage = chunk.usage;
                    }

                    if (chunk.text && onChunk) {
                        await onChunk(chunk.text);
                    }
                }

                // If usage not provided by provider, estimate it
                if (!finalUsage) {
                    tokenCount += fullResponse.length / 4; // Rough est
                } else {
                    tokenCount = finalUsage.totalTokens;
                }

                // Check for tool calls
                const toolCall = this.extractToolCall(fullResponse);

                if (toolCall) {
                    this.logger.info('Tool call detected', { tool: toolCall.tool });

                    // Execute tool (handled by ToolExecutor in coordinator)
                    // For now, just return the tool call
                    return {
                        text: fullResponse,
                        toolCalls: [toolCall]
                    };
                } else {
                    // Final response (no tool needed)
                    break;
                }
            }

            if (turnCount >= this.MAX_TURNS) {
                this.logger.warn(`Re-Act loop reached max turns (${this.MAX_TURNS})`);
                fullResponse = "I'm sorry, I'm having trouble completing this request. It seems a bit too complex.";
            }

            // Month-2: Record LLM metrics
            const llmDuration = Date.now() - llmStartTime;
            const tokensPerSecond = tokenCount / (llmDuration / 1000);

            metrics.recordLLMLatency(llmDuration);
            metrics.recordLLMTokensPerSecond(tokensPerSecond);

            this.logger.info('LLM generation complete', {
                duration: llmDuration,
                tokens: tokenCount,
                tokensPerSecond: tokensPerSecond.toFixed(2)
            });

            // Month-3: Cache the response
            if (FEATURE_FLAGS.ENABLE_LLM_CACHE) {
                await llmCache.set(context.transcript, fullResponse, context);
            }

            return {
                text: fullResponse,
                tokenUsage: {
                    promptTokens: 0, // We don't have prompt tokens easily available here unless provider sends it
                    completionTokens: tokenCount,
                    totalTokens: tokenCount
                }
            };

        } catch (error) {
            this.logger.error('LLM generation failed', { error });
            metrics.incrementErrors('llm', 'generation');
            throw new LLMError(`Failed to generate LLM response: ${(error as Error).message}`, 'llm-executor');
        }
    }

    private extractToolCall(response: string): any | null {
        const trimmedResponse = response.trim();

        // Enhanced tool call detection
        if (trimmedResponse.includes('"tool"') || trimmedResponse.includes('```json')) {
            let jsonContent = trimmedResponse;

            // Strategy 1: Extract from markdown code block
            const markdownMatch = trimmedResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (markdownMatch) {
                jsonContent = markdownMatch[1].trim();
            }
            // Strategy 2: Find first { to last }
            else if (trimmedResponse.includes('{')) {
                const firstBrace = trimmedResponse.indexOf('{');
                const lastBrace = trimmedResponse.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    jsonContent = trimmedResponse.substring(firstBrace, lastBrace + 1);
                }
            }

            // Try to parse the extracted JSON
            try {
                const parsed = JSON.parse(jsonContent);

                // Validate that it has required fields and tool exists
                if (parsed.tool && parsed.params !== undefined) {
                    const toolExists = toolRegistry.getTool(parsed.tool);
                    if (toolExists) {
                        return parsed;
                    } else {
                        this.logger.warn(`Tool "${parsed.tool}" not found in registry`);
                    }
                }
            } catch (e) {
                this.logger.warn(`Failed to parse potential tool call JSON: ${e}`);
            }
        }

        return null;
    }
}

export default new LLMExecutor();
