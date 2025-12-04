// gnani-rnd-backend/src/core/llm/llm.manager.ts

import { LLMProvider, GenerateOptions, LLMResponse, Tool } from './llm.interface.js';
import { OllamaProvider } from './ollama.provider.js';
import logger from '../logger/logger.js';

export type TaskType = 'chat' | 'code' | 'planning' | 'tool';

export class LLMManager {
    private providers: Map<string, LLMProvider> = new Map();
    public currentProvider: LLMProvider; // Made public for health checks

    constructor() {
        // Initialize default provider
        const defaultProvider = new OllamaProvider();
        this.providers.set('ollama', defaultProvider);
        this.currentProvider = defaultProvider;

        logger.info('LLMManager initialized', {
            provider: this.currentProvider.name,
            model: (this.currentProvider as OllamaProvider).getModel()
        });
    }

    // Main generation method
    async *generate(prompt: string, options?: GenerateOptions): AsyncIterableIterator<LLMResponse> {
        const available = await this.currentProvider.isAvailable();
        if (!available) {
            throw new Error(`LLM provider ${this.currentProvider.name} is not available`);
        }

        logger.debug('Generating response', {
            provider: this.currentProvider.name,
            promptLength: prompt.length
        });

        yield* this.currentProvider.generate(prompt, options);
    }

    // Generation with tools
    async *generateWithTools(
        prompt: string,
        tools: Tool[],
        options?: GenerateOptions
    ): AsyncIterableIterator<LLMResponse> {
        const available = await this.currentProvider.isAvailable();
        if (!available) {
            throw new Error(`LLM provider ${this.currentProvider.name} is not available`);
        }

        logger.debug('Generating with tools', {
            provider: this.currentProvider.name,
            toolCount: tools.length
        });

        yield* this.currentProvider.generateWithTools(prompt, tools, options);
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
