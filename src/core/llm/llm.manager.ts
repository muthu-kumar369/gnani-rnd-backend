// gnani-rnd-backend/src/core/llm/llm.manager.ts

import { LLMProvider, GenerateOptions, LLMResponse, Tool } from './llm.interface.js';
import { OllamaProvider } from './ollama.provider.js';
import { LlamaCppProvider } from './providers/llamacpp.provider.js';
import { VLLMProvider } from './providers/vllm.provider.js';
import { LocalAIProvider } from './providers/localai.provider.js';
import logger from '../logger/logger.js';

export type TaskType = 'chat' | 'code' | 'planning' | 'tool';

export class LLMManager {
    private providers: Map<string, LLMProvider> = new Map();
    private providerList: LLMProvider[] = []; // Ordered list for failover
    private currentProviderIndex: number = 0;
    public currentProvider: LLMProvider; // Made public for health checks

    constructor() {
        // Initialize providers
        const ollama = new OllamaProvider();
        const llamaCpp = new LlamaCppProvider();
        const vllm = new VLLMProvider();
        const localAi = new LocalAIProvider();

        this.providers.set('ollama', ollama);
        this.providers.set('llamacpp', llamaCpp);
        this.providers.set('vllm', vllm);
        this.providers.set('localai', localAi);

        // Select default provider based on env
        const defaultProviderName = process.env.DEFAULT_LLM_PROVIDER || 'ollama';
        this.currentProvider = this.providers.get(defaultProviderName) || ollama;

        // Create ordered list for failover
        this.providerList = Array.from(this.providers.values());
        this.currentProviderIndex = this.providerList.indexOf(this.currentProvider);

        logger.info('LLMManager initialized', {
            provider: this.currentProvider.name,
            availableProviders: Array.from(this.providers.keys())
        });
    }

    // Main generation method with automatic failover
    async *generate(prompt: string, options?: GenerateOptions): AsyncIterableIterator<LLMResponse> {
        const maxAttempts = this.providerList.length;
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const provider = this.providerList[this.currentProviderIndex];

            try {
                const available = await provider.isAvailable();
                if (!available) {
                    throw new Error(`Provider ${provider.name} is not available`);
                }

                logger.info('Attempting generation with provider', {
                    provider: provider.name,
                    attempt: attempt + 1,
                    maxAttempts
                });

                yield* provider.generate(prompt, options);
                return; // Success, exit
            } catch (error: any) {
                lastError = error;
                logger.warn(`[FAILOVER] Provider ${provider.name} failed (Attempt ${attempt + 1}/${maxAttempts}). Switching to next provider...`, {
                    failedProvider: provider.name,
                    error: error.message,
                    nextProvider: this.providerList[(this.currentProviderIndex + 1) % this.providerList.length].name
                });

                // Rotate to next provider
                this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providerList.length;
                this.currentProvider = this.providerList[this.currentProviderIndex];

                if (attempt === maxAttempts - 1) {
                    logger.error('All LLM providers failed', { error: lastError?.message });
                    throw new Error('All LLM providers failed');
                }
            }
        }

        throw lastError || new Error('All LLM providers failed');
    }

    /**
     * Legacy method for explicit failover call (deprecated, use generate instead)
     */
    async *generateWithFailover(
        prompt: string,
        options?: GenerateOptions
    ): AsyncIterableIterator<LLMResponse> {
        yield* this.generate(prompt, options);
    }

    // Generation with tools
    // Generation with tools with automatic failover
    async *generateWithTools(
        prompt: string,
        tools: Tool[],
        options?: GenerateOptions
    ): AsyncIterableIterator<LLMResponse> {
        const maxAttempts = this.providerList.length;
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const provider = this.providerList[this.currentProviderIndex];

            try {
                const available = await provider.isAvailable();
                if (!available) {
                    throw new Error(`Provider ${provider.name} is not available`);
                }

                logger.debug('Generating with tools', {
                    provider: provider.name,
                    toolCount: tools.length,
                    attempt: attempt + 1
                });

                yield* provider.generateWithTools(prompt, tools, options);
                return; // Success
            } catch (error: any) {
                lastError = error;
                logger.warn(`[FAILOVER] Provider ${provider.name} failed during tool generation (Attempt ${attempt + 1}/${maxAttempts}). Switching...`, {
                    failedProvider: provider.name,
                    error: error.message
                });

                // Rotate
                this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providerList.length;
                this.currentProvider = this.providerList[this.currentProviderIndex];

                if (attempt === maxAttempts - 1) {
                    throw new Error('All LLM providers failed during tool generation');
                }
            }
        }

        throw lastError || new Error('All LLM providers failed');
    }

    // Check health of current provider
    async checkHealth(): Promise<boolean> {
        return await this.currentProvider.isAvailable();
    }

    // Future: Select provider based on task type
    selectProvider(taskType: TaskType): void {
        // For now, always use default Ollama
        // Future: Route to specialized models
        switch (taskType) {
            case 'code':
                // Future: this.currentProvider = this.providers.get('ollama-code') || this.currentProvider;
                logger.debug('Code task - using default provider (future: CodeLlama)');
                break;
            case 'planning':
                // Future: this.currentProvider = this.providers.get('ollama-planner') || this.currentProvider;
                logger.debug('Planning task - using default provider (future: Llama 70B)');
                break;
            default:
                this.currentProvider = this.providers.get('ollama')!;
        }

        logger.debug('Provider selected', { taskType, provider: this.currentProvider.name });
    }

    // Get current provider info
    getProviderInfo() {
        return {
            name: this.currentProvider.name,
            supportsFunctionCalling: this.currentProvider.supportsFunctionCalling,
            maxContextLength: this.currentProvider.maxContextLength,
            model: (this.currentProvider as OllamaProvider).getModel?.() || 'unknown'
        };
    }

    // Add a new provider (for future multi-agent)
    addProvider(name: string, provider: LLMProvider): void {
        this.providers.set(name, provider);
        logger.info('Provider added', { name, providerType: provider.name });
    }

    // Check if a provider exists
    hasProvider(name: string): boolean {
        return this.providers.has(name);
    }
}

// Singleton instance
export const llmManager = new LLMManager();
