// gnani-rnd-backend/src/config/llm.config.ts

export const LLM_CONFIG = {
    defaultProvider: process.env.LLM_PROVIDER || 'ollama',

    providers: {
        ollama: {
            baseUrl: process.env.LLM_SERVER_URL || 'http://localhost:11434',
            models: {
                chat: process.env.LLM_MODEL || 'llama3.1:8b',
                code: process.env.LLM_CODE_MODEL || 'llama3.1:8b', // Future: codellama
                planning: process.env.LLM_PLANNING_MODEL || 'llama3.1:8b' // Future: llama3.1:70b
            }
        }
    },

    generation: {
        temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
        maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '200'),
        streamingEnabled: process.env.LLM_STREAMING_ENABLED !== 'false' // Default true
    }
};

// Model Registry for User-Preferred Model Routing
export interface ModelConfig {
    provider: 'ollama' | 'openai' | 'anthropic';
    modelName: string;
    endpoint?: string;
    displayName: string;
    description?: string;
    contextWindow?: number;
}

export const AVAILABLE_MODELS: Record<string, ModelConfig> = {
    'llama3': {
        provider: 'ollama',
        modelName: 'llama3.1:8b',
        endpoint: process.env.LLM_SERVER_URL || 'http://localhost:11434',
        displayName: 'Llama 3.1 8B',
        description: 'Meta\'s latest open-source model (8B parameters)',
        contextWindow: 8192,
    },
    'llama3-70b': {
        provider: 'ollama',
        modelName: 'llama3.1:70b',
        endpoint: process.env.LLM_SERVER_URL || 'http://localhost:11434',
        displayName: 'Llama 3.1 70B',
        description: 'Larger Llama 3 model for complex tasks',
        contextWindow: 8192,
    },
    'mistral': {
        provider: 'ollama',
        modelName: 'mistral:latest',
        endpoint: process.env.LLM_SERVER_URL || 'http://localhost:11434',
        displayName: 'Mistral',
        description: 'Mistral AI\'s efficient model',
        contextWindow: 8192,
    },
    'codellama': {
        provider: 'ollama',
        modelName: 'codellama:latest',
        endpoint: process.env.LLM_SERVER_URL || 'http://localhost:11434',
        displayName: 'Code Llama',
        description: 'Specialized for code generation',
        contextWindow: 16384,
    },
    'phi3': {
        provider: 'ollama',
        modelName: 'phi3:latest',
        endpoint: process.env.LLM_SERVER_URL || 'http://localhost:11434',
        displayName: 'Phi-3',
        description: 'Microsoft\'s compact model',
        contextWindow: 4096,
    },
};

export const DEFAULT_MODEL = 'llama3';

// Get model config with fallback to default
export function getModelConfig(modelId: string): ModelConfig {
    return AVAILABLE_MODELS[modelId] || AVAILABLE_MODELS[DEFAULT_MODEL];
}

// Get list of available models for frontend
export function getAvailableModelsList() {
    return Object.entries(AVAILABLE_MODELS).map(([id, config]) => ({
        id,
        displayName: config.displayName,
        description: config.description,
        provider: config.provider,
    }));
}
