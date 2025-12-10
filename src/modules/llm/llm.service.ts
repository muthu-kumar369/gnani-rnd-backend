// src/services/llmService.ts
import { createContextualLogger } from '../../core/logger/logger.js';
import metrics from '../../core/monitoring/metrics.js';
import auditService from '../../core/logger/audit.service.js';
import latencyMonitor from '../../core/monitoring/latency.monitor.js';
import config from '../../config/app.config.js'; // STAGE 1: Use centralized config
import { Logger } from 'winston';

import { CircuitBreaker } from '../../core/reliability/circuit-breaker.js';
import crypto from 'crypto';
import redis from '../../config/redis.config.js';
import { getModelConfig, DEFAULT_MODEL } from '../../config/llm.config.js';
import tokenCounterService, { TokenUsage } from './token-counter.service.js';
import { traceAsyncOperation } from '../../core/monitoring/tracing.helper.js';
import { contentFilter } from '../../core/security/content-filter.service.js';
import { piiDetector } from '../../core/security/pii-detector.service.js';
import { securityAudit } from '../../core/logger/security-audit.service.js';
import deduplicationService from '../../core/cache/deduplication.service.js'; // Stage 4
import { ContextManager } from './context-manager.service.js'; // STAGE 1

// Import LLM Manager
import { llmManager } from '../../core/llm/llm.manager.js';
import { Tool } from '../../core/llm/llm.interface.js';

// TODO Stage 4: Wrap getLlmResponse cache check (line 181-192) with:
// deduplicationService.deduplicate(dedupKey, async () => { /* cache check + LLM call */ }, 5*60*1000)

class LlmService {
    private logger: Logger;
    private circuitBreaker: CircuitBreaker;
    private contextManager: ContextManager; // STAGE 1: Context window management

    constructor() {
        this.logger = createContextualLogger({ module: 'LlmService' });

        // Initialize Circuit Breaker
        // Note: Individual providers might have their own timeouts/breakers, 
        // but this protects the LlmService layer
        this.circuitBreaker = new CircuitBreaker('LLM_API', {
            failureThreshold: 5,
            resetTimeoutMs: 30000,
            requestTimeoutMs: 60000
        });

        // STAGE 1: Initialize context manager with model token limits
        this.contextManager = new ContextManager('gpt-3.5-turbo', config.LLM_MAX_TOKENS);

        this.logger.info('LlmService initialized with Circuit Breaker (Unified Backend).');
        auditService.logEvent('LLM_SERVICE_INIT', null, null, {}, 'success');
    }

    private generateCacheKey(prompt: any): string {
        const normalized = JSON.stringify({
            query: prompt.current_user_query,
            intent: prompt.classified_intent,
            system: prompt.system_message?.substring(0, 100), // First 100 chars
            model: prompt.model || 'default'
        });
        return `llm:${crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16)}`;
    }

    /**
     * Get model path based on user preference with fallback to default
     */
    private getModelPath(preferredModel?: string): string {
        if (!preferredModel) {
            return config.LLM_MODEL;
        }

        const modelConfig = getModelConfig(preferredModel);
        this.logger.debug(`Using model: ${modelConfig.modelName} (requested: ${preferredModel})`);
        return modelConfig.modelName;
    }

    async getToolDecision(decisionPrompt: any, preferredModel?: string): Promise<{ needs_tool: boolean, tool_name?: string, parameters?: any }> {
        const sessionId = decisionPrompt.session_id;
        this.logger.debug(`Getting tool decision for session ${sessionId}`);

        return traceAsyncOperation('llm.getToolDecision', async () => {
            try {
                // Format prompt 
                const promptText = `System: ${decisionPrompt.system_message}\n\nUser: ${decisionPrompt.user_query}`;

                // Use LLM Manager
                // We use generating logic expecting JSON
                const options = {
                    model: this.getModelPath(preferredModel),
                    maxTokens: 200,
                    temperature: 0.1,
                    stream: false,
                    stopSequences: ["User:", "System:"]
                };

                let content = '';
                const iterator = llmManager.generate(promptText, options);

                for await (const chunk of iterator) {
                    content += chunk.text;
                }

                // Parse JSON
                const markdownMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (markdownMatch) {
                    content = markdownMatch[1];
                } else {
                    const firstBrace = content.indexOf('{');
                    const lastBrace = content.lastIndexOf('}');
                    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                        content = content.substring(firstBrace, lastBrace + 1);
                    }
                }

                try {
                    const decision = JSON.parse(content);
                    this.logger.info(`Tool decision for session ${sessionId}: ${JSON.stringify(decision)}`);
                    return decision;
                } catch (e) {
                    this.logger.warn(`Failed to parse tool decision JSON: ${content}`);
                    return { needs_tool: false };
                }

            } catch (error: any) {
                this.logger.error(`Error getting tool decision: ${error.message}`);
                return { needs_tool: false };
            }
        }, { 'session.id': sessionId, 'model': preferredModel || 'default' });
    }

    async generateTitle(conversationContext: string): Promise<string> {
        this.logger.debug('Generating conversation title');

        return traceAsyncOperation('llm.generateTitle', async () => {
            try {
                const systemPrompt = `You are a title generator. Given a conversation excerpt, generate a concise, descriptive title (max 60 characters). Output only the title, nothing else.`;
                const userPrompt = `Conversation:\n${conversationContext}\n\nGenerate a title:`;
                const promptText = `${systemPrompt}\n\n${userPrompt}`;

                let title = '';
                const iterator = llmManager.generate(promptText, {
                    maxTokens: 20,
                    temperature: 0.3,
                    stream: false,
                    stopSequences: ["\n", "User:", "Assistant:"]
                });

                for await (const chunk of iterator) {
                    title += chunk.text;
                }

                title = title.trim().replace(/^["']|["']$/g, '');

                if (title.length > 60) title = title.substring(0, 57) + '...';

                if (!title || title.length < 3) return 'New Conversation';

                metrics.incLlmCall('title-generation', 'title_generation', 'success');
                return title;

            } catch (error: any) {
                this.logger.error(`Error generating title: ${error.message}`);
                metrics.incLlmCall('title-generation', 'title_generation', 'failure');
                return 'New Conversation';
            }
        }, { 'context.length': conversationContext.length });
    }

    async getLlmResponse(structuredPrompt: any, onPartialResponse: ((response: { text: string }) => Promise<void> | void) | null = null, preferredModel?: string): Promise<{ text: string, action: any, tokenUsage?: TokenUsage }> {
        const sessionId = structuredPrompt.session_id;
        const userId = structuredPrompt.user_id;
        this.logger.debug(`Sending prompt to LLM for session ${sessionId}`);
        auditService.logLlmEvent(userId, sessionId, structuredPrompt, null, 'info', null);

        return traceAsyncOperation('llm.getLlmResponse', async () => {
            // SECURITY: Content filtering
            if (process.env.CONTENT_FILTER_ENABLED === 'true') {
                const inputFilter = await contentFilter.filterInput(structuredPrompt.current_user_query, userId);
                if (!inputFilter.allowed) {
                    securityAudit.logContentFiltered(userId, inputFilter.reason!, inputFilter.categories);
                    throw new Error(`Content policy violation: ${inputFilter.reason}`);
                }
            }

            const cacheKey = this.generateCacheKey({ ...structuredPrompt, model: preferredModel });

            // Stage 4: Deduplication for non-streaming requests only
            // Note: Streaming is always enabled in current setup
            if (!onPartialResponse) {
                return await deduplicationService.deduplicate(
                    `llm:${cacheKey}`,
                    async () => {
                        // Check cache
                        try {
                            const cached = await redis.get(cacheKey);
                            if (cached) {
                                metrics.incrementLLMCacheHit();
                                const response = JSON.parse(cached);
                                if (onPartialResponse) await onPartialResponse({ type: 'complete_response', text: response.text } as any);
                                return response;
                            }
                            metrics.incrementLLMCacheMiss();
                        } catch (cacheError) { }

                        // Execute LLM (rest of the method below)
                        return await this.executeLlmInternal(structuredPrompt, onPartialResponse, preferredModel, cacheKey, sessionId, userId);
                    },
                    5 * 60 * 1000
                );
            }

            // Streaming: check cache then execute
            try {
                const cached = await redis.get(cacheKey);
                if (cached) {
                    metrics.incrementLLMCacheHit();
                    const response = JSON.parse(cached);
                    if (onPartialResponse) await onPartialResponse({ type: 'complete_response', text: response.text } as any);
                    return response;
                }
                metrics.incrementLLMCacheMiss();
            } catch (cacheError) { }

            return await this.executeLlmInternal(structuredPrompt, onPartialResponse, preferredModel, cacheKey, sessionId, userId);
        }, {
            'session.id': sessionId,
            'user.id': userId,
            'intent': structuredPrompt.classified_intent,
            'model': preferredModel || 'default'
        });
    }

    private async executeLlmInternal(
        structuredPrompt: any,
        onPartialResponse: ((response: { text: string }) => Promise<void> | void) | null,
        preferredModel: string | undefined,
        cacheKey: string,
        sessionId: string,
        userId: string
    ): Promise<{ text: string, action: any, tokenUsage?: TokenUsage }> {
        try {
            const formattedPrompt = this._formatPromptForLLM(structuredPrompt);

            // Unified Generation via LLMManager
            return await this.circuitBreaker.execute(async () => {
                let llmOutput = '';
                let action = null;
                let tokenUsage: TokenUsage | undefined;

                latencyMonitor.startTimer(sessionId, 'llm_total');
                latencyMonitor.startTimer(sessionId, 'llm_ttft');
                let firstTokenReceived = false;

                const options = {
                    model: this.getModelPath(preferredModel),
                    maxTokens: config.LLM_MAX_TOKENS,
                    temperature: config.LLM_TEMPERATURE,
                    stream: true, // Always stream
                    stopSequences: ["User:", "System:", "Assistant:", "\nUser:", "\nAssistant:"]
                };

                const iterator = llmManager.generate(formattedPrompt, options);

                for await (const chunk of iterator) {
                    const newContent = chunk.text;
                    llmOutput += newContent;

                    if (!firstTokenReceived && newContent.trim().length > 0) {
                        latencyMonitor.endTimer(sessionId, 'llm_ttft');
                        firstTokenReceived = true;
                    }

                    // Usage tracking
                    if (chunk.usage) {
                        tokenUsage = tokenCounterService.createUsage(
                            chunk.usage.promptTokens,
                            chunk.usage.completionTokens,
                            options.model
                        );
                    }

                    if (onPartialResponse && newContent) {
                        // Directly stream what we get from provider
                        // @ts-ignore
                        await onPartialResponse({ type: 'partial', text: newContent });
                    }
                }

                if (onPartialResponse) {
                    // @ts-ignore
                    await onPartialResponse({ type: 'final', text: '' }); // Final signal
                }

                latencyMonitor.endTimer(sessionId, 'llm_total');

                // Check for simple actions (heuristic)
                if (structuredPrompt.classified_intent === 'system_command') {
                    action = { action: 'OPEN_APP', app_name: 'Terminal' };
                }

                metrics.incLlmCall(sessionId, structuredPrompt.classified_intent, 'success');
                auditService.logLlmEvent(userId, sessionId, structuredPrompt, { text: llmOutput, action }, 'success');

                // Cache response
                try {
                    await redis.setex(cacheKey, 3600, JSON.stringify({ text: llmOutput, action }));
                } catch (e) { }

                // PII Masking
                if (process.env.PII_MASKING_ENABLED === 'true' && llmOutput) {
                    llmOutput = piiDetector.maskPII(llmOutput);
                }

                return { text: llmOutput, action, tokenUsage };
            });

        } catch (error: any) {
            this.logger.error(`Error in LlmService: ${error.message}`);
            metrics.incLlmCall(sessionId, structuredPrompt.classified_intent, 'failure');
            auditService.logLlmEvent(userId, sessionId, structuredPrompt, null, 'failure', error.message);
            return {
                text: "I'm sorry, I'm having trouble connecting to my brain right now.",
                action: null
            };
        }
    }

    private _formatPromptForLLM(structuredPrompt: any): string {
        // STAGE 1: Build messages array for context manager
        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

        // Add conversation history
        if (structuredPrompt.conversation_history && structuredPrompt.conversation_history.length > 0) {
            structuredPrompt.conversation_history.forEach((interaction: any) => {
                if (interaction.query) {
                    messages.push({ role: 'user', content: interaction.query });
                }
                if (interaction.response) {
                    messages.push({ role: 'assistant', content: interaction.response });
                }
            });
        }

        // Add current query
        messages.push({ role: 'user', content: structuredPrompt.current_user_query });

        // STAGE 1: Truncate context if needed
        const { messages: truncatedMessages, truncated } = this.contextManager.truncateContext(
            messages,
            structuredPrompt.system_message
        );

        if (truncated) {
            this.logger.warn('Context window truncated for LLM', {
                originalMessages: messages.length,
                truncatedMessages: truncatedMessages.length - 1 // -1 for system message
            });
        }

        // Format truncated messages for LLM
        let promptParts: string[] = [];

        for (const msg of truncatedMessages) {
            if (msg.role === 'system') {
                promptParts.push(`System: ${msg.content}`);
            } else if (msg.role === 'user') {
                promptParts.push(`User: ${msg.content}`);
            } else if (msg.role === 'assistant') {
                promptParts.push(`Assistant: ${msg.content}`);
            }
        }

        promptParts.push(`\n=== CURRENT INTERACTION ===`);
        promptParts.push(`Assistant:`);

        return promptParts.join('\n');
    }
}

export default new LlmService();
