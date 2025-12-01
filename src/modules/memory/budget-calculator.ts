// src/modules/memory/budget-calculator.ts
import { createContextualLogger } from '../../core/logger/logger.js';
import { Logger } from 'winston';
import { QueryComplexity } from '../context/query-analyzer.js';

export interface BudgetCalculation {
    totalBudget: number;
    breakdown: {
        base: number;
        complexityAdjustment: number;
        depthAdjustment: number;
        memoryAdjustment: number;
    };
    reasoning: string;
}

class BudgetCalculator {
    private logger: Logger;
    private readonly BASE_BUDGET = 4000;
    private readonly MIN_BUDGET = 2000;
    private readonly MAX_BUDGET = 8000;

    constructor() {
        this.logger = createContextualLogger({ module: 'BudgetCalculator' });
    }

    /**
     * Calculate adaptive token budget based on query complexity and context
     */
    calculateAdaptiveBudget(
        queryComplexity: QueryComplexity,
        conversationDepth: number,
        availableMemoryCount: number
    ): BudgetCalculation {
        const base = this.BASE_BUDGET;

        // 1. Complexity adjustment (0-2000 tokens)
        const complexityAdjustment = this.calculateComplexityAdjustment(queryComplexity);

        // 2. Conversation depth adjustment (0-1000 tokens)
        const depthAdjustment = this.calculateDepthAdjustment(conversationDepth);

        // 3. Available memory adjustment (0-1000 tokens)
        const memoryAdjustment = this.calculateMemoryAdjustment(availableMemoryCount);

        // Calculate total
        const totalBudget = Math.min(
            Math.max(
                base + complexityAdjustment + depthAdjustment + memoryAdjustment,
                this.MIN_BUDGET
            ),
            this.MAX_BUDGET
        );

        const reasoning = this.generateReasoning(
            queryComplexity,
            conversationDepth,
            availableMemoryCount,
            totalBudget
        );

        this.logger.debug(`Adaptive budget: ${totalBudget} tokens (${reasoning})`);

        return {
            totalBudget,
            breakdown: {
                base,
                complexityAdjustment,
                depthAdjustment,
                memoryAdjustment
            },
            reasoning
        };
    }

    /**
     * Calculate complexity-based adjustment
     */
    private calculateComplexityAdjustment(complexity: QueryComplexity): number {
        // Simple queries need less context
        // Complex queries need more context

        const adjustmentMap = {
            'simple': -500,          // 3500 tokens
            'moderate': 0,           // 4000 tokens (base)
            'complex': 1000,         // 5000 tokens
            'very_complex': 2000     // 6000 tokens
        };

        return adjustmentMap[complexity.category];
    }

    /**
     * Calculate conversation depth adjustment
     */
    private calculateDepthAdjustment(conversationDepth: number): number {
        // Deeper conversations need more context
        // Normalize depth to 0-1 (assume max depth of 20 messages)
        const normalizedDepth = Math.min(conversationDepth / 20, 1.0);

        // Scale to 0-1000 tokens
        return Math.floor(normalizedDepth * 1000);
    }

    /**
     * Calculate available memory adjustment
     */
    private calculateMemoryAdjustment(availableMemoryCount: number): number {
        // More available memories = allocate more budget
        // Normalize to 0-1 (assume max 100 memories)
        const normalizedMemory = Math.min(availableMemoryCount / 100, 1.0);

        // Scale to 0-1000 tokens
        return Math.floor(normalizedMemory * 1000);
    }

    /**
     * Generate human-readable reasoning
     */
    private generateReasoning(
        complexity: QueryComplexity,
        depth: number,
        memoryCount: number,
        budget: number
    ): string {
        const reasons: string[] = [];

        // Complexity reasoning
        if (complexity.category === 'simple') {
            reasons.push('simple query');
        } else if (complexity.category === 'very_complex') {
            reasons.push('very complex query');
        } else if (complexity.category === 'complex') {
            reasons.push('complex query');
        }

        // Depth reasoning
        if (depth > 10) {
            reasons.push('deep conversation');
        } else if (depth > 5) {
            reasons.push('moderate conversation depth');
        }

        // Memory reasoning
        if (memoryCount > 50) {
            reasons.push('rich memory context');
        } else if (memoryCount > 20) {
            reasons.push('moderate memory available');
        }

        // Budget level
        if (budget >= 6000) {
            reasons.push('high budget allocated');
        } else if (budget <= 3000) {
            reasons.push('low budget allocated');
        }

        return reasons.join(', ') || 'standard budget';
    }

    /**
     * Get budget statistics for monitoring
     */
    getBudgetStats(): any {
        return {
            baseBudget: this.BASE_BUDGET,
            minBudget: this.MIN_BUDGET,
            maxBudget: this.MAX_BUDGET,
            range: `${this.MIN_BUDGET}-${this.MAX_BUDGET} tokens`
        };
    }
}

export default new BudgetCalculator();
