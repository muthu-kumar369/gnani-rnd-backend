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
