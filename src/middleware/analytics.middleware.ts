import { Request, Response, NextFunction } from 'express';
import { Analytics } from '../models/analytics.model.js';
import { createContextualLogger } from '../core/logger/logger.js';

const logger = createContextualLogger({ module: 'AnalyticsMiddleware' });

// Pricing per 1K tokens (example rates)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
    'claude-3-opus': { input: 0.015, output: 0.075 },
    'claude-3-sonnet': { input: 0.003, output: 0.015 },
    'gemini-pro': { input: 0.00025, output: 0.0005 },
};

export const calculateCost = (tokens: number, model: string): number => {
    const pricing = MODEL_PRICING[model] || { input: 0.001, output: 0.002 };
    // Assume 50/50 split between input and output tokens
    const inputTokens = tokens * 0.5;
    const outputTokens = tokens * 0.5;
    return ((inputTokens / 1000) * pricing.input) + ((outputTokens / 1000) * pricing.output);
};

export const trackTokenUsage = async (
    userId: string,
    conversationId: string,
    tokens: number,
    model: string,
    duration: number
) => {
    try {
        const cost = calculateCost(tokens, model);

        await Analytics.create({
            userId,
            conversationId,
            event: 'tokens_used',
            metadata: {
                tokens,
                cost,
                model,
                duration,
            },
        });

        logger.info(`Token usage tracked: ${tokens} tokens, $${cost.toFixed(4)} for user ${userId}`);
    } catch (error) {
        logger.error('Failed to track token usage', error as Error);
    }
};

export const trackEvent = async (
    userId: string,
    event: string,
    metadata?: Record<string, any>,
    conversationId?: string
) => {
    try {
        await Analytics.create({
            userId,
            conversationId,
            event,
            metadata: metadata || {},
        });

        logger.debug(`Event tracked: ${event} for user ${userId}`);
    } catch (error) {
        logger.error('Failed to track event', error as Error);
    }
};
