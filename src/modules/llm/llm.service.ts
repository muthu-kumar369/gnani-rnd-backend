// src/modules/llm/llm.service.ts
import { createContextualLogger } from '../../core/logger/logger.js';
import sessionReplayService from '../session/session-replay.service.js';
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
import { executeWithRecovery } from '../../core/utils/error-recovery.utils.js';

// Import LLM Manager
import { llmManager } from '../../core/llm/llm.manager.js';
import { Tool } from '../../core/llm/llm.interface.js';
import multiStepPlanner from '../planner/multi-step-planner.service.js'; // STAGE 3: Multi-step planning
import { TitleGeneratorHelper } from './helpers/title-generator.helper.js';
import { ToolDecisionHelper } from './helpers/tool-decision.helper.js';
import { PromptHelper } from './helpers/prompt.helper.js';
import { SynthesisHelper } from './helpers/synthesis.helper.js';

// TODO Stage 4: Wrap getLlmResponse cache check (line 181-192) with:
// deduplicationService.deduplicate(dedupKey, async () => { /* cache check + LLM call */ }, 5*60*1000)

class LlmService {
    private logger: Logger;
    private circuitBreaker: CircuitBreaker;
    private contextManager: ContextManager; // STAGE 1: Context window management
    private titleGenerator: TitleGeneratorHelper;
    private toolDecisionHelper: ToolDecisionHelper;
    private promptHelper: PromptHelper;
    private synthesisHelper: SynthesisHelper;

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
        // STAGE 1: Initialize context manager with model token limits
        this.contextManager = new ContextManager('gpt-3.5-turbo', config.LLM_MAX_TOKENS);

        // Initialize Helpers
        this.titleGenerator = new TitleGeneratorHelper(this.logger);
        this.toolDecisionHelper = new ToolDecisionHelper(this.logger);
        this.promptHelper = new PromptHelper(this.logger);
        this.synthesisHelper = new SynthesisHelper(this.logger);

        this.logger.info('LlmService initialized with Circuit Breaker (Unified Backend).');
        auditService.logEvent('LLM_SERVICE_INIT', null, null, {}, 'success');
    }

    /**
     * STAGE 3: Detect if query requires multi-step planning
     */
    private requiresMultiStepPlanning(query: string): boolean {
        const complexityIndicators = [
            /research.*and.*create/i,
            /analyze.*then.*summarize/i,
            /find.*and.*compare/i,
            /gather.*information.*about/i,
            /step by step/i,
            /first.*then/i,
            /start by.*then/i,
            /multiple.*steps/i,
            /several things/i,
            /and also/i,
            /chain of thought/i
        ];

        return complexityIndicators.some(pattern => pattern.test(query));
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
        return this.toolDecisionHelper.getToolDecision(decisionPrompt, this.getModelPath(preferredModel));
    }

    async generateTitle(conversationContext: string): Promise<string> {
        return this.titleGenerator.generateTitle(conversationContext);
    }

    async getLlmResponse(structuredPrompt: any, onPartialResponse: ((response: { text: string }) => Promise<void> | void) | null = null, preferredModel?: string): Promise<{ text: string, action: any, tokenUsage?: TokenUsage }> {
        const sessionId = structuredPrompt.session_id;
        const userId = structuredPrompt.user_id;
        this.logger.debug(`Sending prompt to LLM for session ${sessionId}`);
        auditService.logLlmEvent(userId, sessionId, structuredPrompt, null, 'info', null);

        return traceAsyncOperation('llm.getLlmResponse', async () => {
            // STAGE 3: Multi-step planning for complex queries
            if (this.requiresMultiStepPlanning(structuredPrompt.current_user_query)) {
                this.logger.info('Complex query detected, using multi-step planner', { sessionId });
                try {
                    const plan = await multiStepPlanner.createPlan(
                        structuredPrompt.current_user_query,
                        { userId, sessionId }
                    );
                    const executedPlan = await multiStepPlanner.executePlan(plan);

                    // Synthesize final response
                    let synthesis = await this.synthesizeFromPlan(executedPlan, structuredPrompt.current_user_query, preferredModel);

                    // PII Masking
                    if (process.env.PII_MASKING_ENABLED === 'true' && synthesis) {
                        synthesis = piiDetector.maskPII(synthesis);
                    }

                    // Log success
                    metrics.incLlmCall(sessionId, 'planning', 'success');
                    auditService.logLlmEvent(userId, sessionId, structuredPrompt, { text: synthesis, action: null }, 'success');

                    return { text: synthesis, action: null };
                } catch (error: any) {
                    this.logger.warn('Multi-step planning failed, falling back to standard LLM', { error: error.message });
                    // Fall through to standard LLM processing
                }
            }

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
                                // Skip callback for cached responses
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

            // Unified Generation via LLMManager with Recovery
            return await executeWithRecovery(async () => {
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

                    const iterator = llmManager.generateWithFailover(formattedPrompt, options);

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

                    // STAGE 3: Record Assistant Event for Replay
                    sessionReplayService.recordEvent(sessionId, 'llm_response', {
                        text: llmOutput,
                        tokenUsage
                    });

                    return { text: llmOutput, action, tokenUsage };
                });
            }, {
                retries: 1, // Only retry once since we have internal failover
                context: `LLM Generation (${sessionId})`,
                onError: (err: any) => this.logger.warn(`LLM generation attempt failed: ${err.message}`)
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
        return this.promptHelper.formatPrompt(structuredPrompt, this.contextManager);
    }

    private async synthesizeFromPlan(plan: any, originalQuery: string, preferredModel?: string): Promise<string> {
        return this.synthesisHelper.synthesizeFromPlan(plan, originalQuery, this.getModelPath(preferredModel));
    }
}

export default new LlmService();
