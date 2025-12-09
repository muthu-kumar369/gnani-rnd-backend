/**
 * Rate limit configurations for different gRPC endpoints
 */
export const RATE_LIMIT_CONFIGS = {
    // Audio streaming - more lenient (long-running connections)
    audioStream: {
        windowMs: 60 * 1000,      // 1 minute
        maxRequests: 10,          // 10 stream starts per minute
    },

    // Session management - moderate
    sessionManagement: {
        windowMs: 60 * 1000,      // 1 minute
        maxRequests: 60,          // 60 requests per minute
    },

    // LLM requests - strict (expensive operations)
    llmRequests: {
        windowMs: 60 * 1000,      // 1 minute
        maxRequests: 30,          // 30 requests per minute
    },

    // Tool execution - moderate
    toolExecution: {
        windowMs: 60 * 1000,      // 1 minute
        maxRequests: 50,          // 50 requests per minute
    },

    // Authentication - very strict
    authentication: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 5,           // 5 attempts per 15 minutes
    },

    // Memory/Vector operations - moderate
    memoryOperations: {
        windowMs: 60 * 1000,      // 1 minute
        maxRequests: 40,          // 40 requests per minute
    },

    // General API - default
    general: {
        windowMs: 60 * 1000,      // 1 minute
        maxRequests: 100,         // 100 requests per minute
    },
};

/**
 * Get rate limit config by endpoint name
 */
export function getRateLimitConfig(endpoint: string): { windowMs: number; maxRequests: number } {
    return RATE_LIMIT_CONFIGS[endpoint as keyof typeof RATE_LIMIT_CONFIGS] || RATE_LIMIT_CONFIGS.general;
}
