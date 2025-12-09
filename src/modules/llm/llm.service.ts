// src/services/llmService.ts
import { createContextualLogger } from '../../core/logger/logger.js';
import metrics from '../../core/monitoring/metrics.js';
import auditService from '../../core/logger/audit.service.js';
import latencyMonitor from '../../core/monitoring/latency.monitor.js';
import {
    LLM_MODEL_PATH,
    LLM_API_KEY,
    LLM_MAX_TOKENS,
    LLM_STREAMING_ENABLED,
    DEFAULT_LLM_PROVIDER
} from '../../config/env.config.js';
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

// Import LLM Manager
import { llmManager } from '../../core/llm/llm.manager.js';
import { Tool } from '../../core/llm/llm.interface.js';

class LlmService {
    private logger: Logger;
    private circuitBreaker: CircuitBreaker;

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
            return LLM_MODEL_PATH;
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

            // Cache Check
            const cacheKey = this.generateCacheKey({ ...structuredPrompt, model: preferredModel });
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
                        maxTokens: LLM_MAX_TOKENS,
                        temperature: 0.7,
                        stream: LLM_STREAMING_ENABLED,
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

                        if (LLM_STREAMING_ENABLED && onPartialResponse && newContent) {
                            // Directly stream what we get from provider
                            // Removed complex stabilization buffer as providers handle decoding
                            // Assuming providers emit valid strings
                            // @ts-ignore
                            await onPartialResponse({ type: 'partial', text: newContent });
                        }
                    }

                    if (LLM_STREAMING_ENABLED && onPartialResponse) {
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
        }, {
            'session.id': sessionId,
            'user.id': userId,
            'intent': structuredPrompt.classified_intent,
            'model': preferredModel || 'default'
        });
    }

    private _formatPromptForLLM(structuredPrompt: any): string {
        let promptParts: string[] = [];
        promptParts.push(`System: ${structuredPrompt.system_message}`);

        if (structuredPrompt.conversation_history && structuredPrompt.conversation_history.length > 0) {
            const maxInteractions = 8;
            const limitedHistory = structuredPrompt.conversation_history.slice(-maxInteractions);
            limitedHistory.forEach((interaction: any) => {
                if (interaction.query) promptParts.push(`User: ${interaction.query}`);
                if (interaction.response) promptParts.push(`Assistant: ${interaction.response}`);
            });
        }

        promptParts.push(`\n=== CURRENT INTERACTION ===`);
        promptParts.push(`User: ${structuredPrompt.current_user_query}`);
        promptParts.push(`Assistant:`);

        return promptParts.join('\n');
    }
}

export default new LlmService();
