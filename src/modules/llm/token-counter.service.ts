import { createContextualLogger } from '../../core/logger/logger.js';

export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
    model: string;
}

export interface ModelPricing {
    inputCostPer1k: number;
    outputCostPer1k: number;
}

// Pricing rates (approximate or virtual for local models)
// Using generic rates for estimation purposes
const MODEL_PRICING: Record<string, ModelPricing> = {
    'llama3': { inputCostPer1k: 0, outputCostPer1k: 0 }, // Local is free
    'llama3-70b': { inputCostPer1k: 0, outputCostPer1k: 0 },
    'mistral': { inputCostPer1k: 0, outputCostPer1k: 0 },
    'gpt-4': { inputCostPer1k: 0.03, outputCostPer1k: 0.06 },
    'gpt-3.5-turbo': { inputCostPer1k: 0.0005, outputCostPer1k: 0.0015 },
    'default': { inputCostPer1k: 0, outputCostPer1k: 0 }
};

class TokenCounterService {
    private logger = createContextualLogger({ module: 'TokenCounterService' });

    /**
     * Calculate estimated cost for token usage
     */
    calculateCost(inputTokens: number, outputTokens: number, model: string): number {
        const pricing = MODEL_PRICING[model] || MODEL_PRICING['default'];

        const inputCost = (inputTokens / 1000) * pricing.inputCostPer1k;
        const outputCost = (outputTokens / 1000) * pricing.outputCostPer1k;

        return Number((inputCost + outputCost).toFixed(6));
    }

    /**
     * Create token usage object
     */
    createUsage(inputTokens: number, outputTokens: number, model: string): TokenUsage {
        return {
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            estimatedCost: this.calculateCost(inputTokens, outputTokens, model),
            model
        };
    }
}

export default new TokenCounterService();
