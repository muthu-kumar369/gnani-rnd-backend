import { LLMBackendProvider, LLMBackendFactory, LLMBackendConfig, LLMRequest, LLMResponse } from './llm-backend.provider.js';
import { createContextualLogger } from '../../../core/logger/logger.js';

export class LLMBackendManager {
    private readonly logger = createContextualLogger({ module: 'LLMBackendManager' });
    private providers: Map<string, LLMBackendProvider> = new Map();
    private defaultProvider: string = 'ollama';

    constructor() {
        this.initializeProviders();
    }

    /**
     * Initialize backend providers from environment config
     */
    private initializeProviders(): void {
        // Ollama (default)
        const ollamaConfig: LLMBackendConfig = {
            type: 'ollama',
            baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
            timeout: 60000,
        };
        this.providers.set('ollama', LLMBackendFactory.createProvider(ollamaConfig));

        // llama.cpp (if configured)
        if (process.env.LLAMACPP_BASE_URL) {
            const llamacppConfig: LLMBackendConfig = {
                type: 'llamacpp',
                baseUrl: process.env.LLAMACPP_BASE_URL,
                timeout: 60000,
            };
            this.providers.set('llamacpp', LLMBackendFactory.createProvider(llamacppConfig));
        }

        // vLLM (if configured)
        if (process.env.VLLM_BASE_URL) {
            const vllmConfig: LLMBackendConfig = {
                type: 'vllm',
                baseUrl: process.env.VLLM_BASE_URL,
                apiKey: process.env.VLLM_API_KEY,
                timeout: 60000,
            };
            this.providers.set('vllm', LLMBackendFactory.createProvider(vllmConfig));
        }

        // LocalAI (if configured)
        if (process.env.LOCALAI_BASE_URL) {
            const localaiConfig: LLMBackendConfig = {
                type: 'localai',
                baseUrl: process.env.LOCALAI_BASE_URL,
                timeout: 60000,
            };
            this.providers.set('localai', LLMBackendFactory.createProvider(localaiConfig));
        }

        this.logger.info(`Initialized ${this.providers.size} LLM backend(s): ${Array.from(this.providers.keys()).join(', ')}`);
    }

    /**
     * Get completion from specified backend
     */
    async generateCompletion(request: LLMRequest, backend?: string): Promise<LLMResponse> {
        const providerName = backend || this.defaultProvider;
        const provider = this.providers.get(providerName);

        if (!provider) {
            throw new Error(`Backend provider '${providerName}' not found`);
        }

        this.logger.debug(`Generating completion using ${providerName} backend`);
        return provider.generateCompletion(request);
    }

    /**
     * Stream completion from specified backend
     */
    async *streamCompletion(request: LLMRequest, backend?: string): AsyncGenerator<string, void, unknown> {
        const providerName = backend || this.defaultProvider;
        const provider = this.providers.get(providerName);

        if (!provider) {
            throw new Error(`Backend provider '${providerName}' not found`);
        }

        this.logger.debug(`Streaming completion using ${providerName} backend`);
        yield* provider.streamCompletion(request);
    }

    /**
     * List available models from backend
     */
    async listModels(backend?: string): Promise<string[]> {
        const providerName = backend || this.defaultProvider;
        const provider = this.providers.get(providerName);

        if (!provider) {
            throw new Error(`Backend provider '${providerName}' not found`);
        }

        return provider.listModels();
    }

    /**
     * Get list of available backends
     */
    getAvailableBackends(): string[] {
        return Array.from(this.providers.keys());
    }

    /**
     * Set default backend
     */
    setDefaultBackend(backend: string): void {
        if (!this.providers.has(backend)) {
            throw new Error(`Backend '${backend}' not available`);
        }
        this.defaultProvider = backend;
        this.logger.info(`Default backend set to: ${backend}`);
    }
}

export default new LLMBackendManager();
