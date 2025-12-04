// src/config/vision.config.ts
export const visionConfig = {
    // Ollama endpoint
    endpoint: process.env.VISION_MODEL_ENDPOINT || 'http://localhost:11434',

    // Model name
    modelName: process.env.VISION_MODEL_NAME || 'llava:7b',

    // Enable/disable vision features
    enabled: process.env.VISION_ENABLED !== 'false',

    // Image optimization settings
    image: {
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 85,
        maxSizeMB: 5
    },

    // Cache settings
    cache: {
        enabled: true,
        ttl: parseInt(process.env.VISION_CACHE_TTL || '3600') // 1 hour default
    },

    // Timeouts
    timeout: {
        analysis: 60000, // 60 seconds
        modelLoad: 120000 // 2 minutes
    }
};
