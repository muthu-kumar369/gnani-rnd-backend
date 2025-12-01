// src/modules/memory/self-adjuster.ts
import { createContextualLogger } from '../../core/logger/logger.js';
import { Logger } from 'winston';

export interface ScoringWeights {
    semantic: number;    // 0-1
    recency: number;     // 0-1
    keywords: number;    // 0-1
}

export interface PerformanceMetrics {
    relevanceScore: number;      // Average relevance of retrieved memories (0-1)
    hitRate: number;             // Percentage of successful retrievals (0-1)
    averageAge: number;          // Average age of retrieved memories (days)
    userSatisfaction?: number;   // Optional user feedback (0-1)
}

export interface FeedbackSignals {
    preferRecent: boolean;       // User prefers recent information
    preferSemantic: boolean;     // User prefers semantically relevant info
    preferKeywords: boolean;     // User prefers keyword matches
}

class SelfAdjuster {
    private logger: Logger;
    private currentWeights: ScoringWeights;
    private defaultWeights: ScoringWeights;
    private adjustmentHistory: Array<{
        timestamp: Date;
        weights: ScoringWeights;
        reason: string;
    }>;

    constructor() {
        this.logger = createContextualLogger({ module: 'SelfAdjuster' });

        // Default weights from Phase 1
        this.defaultWeights = {
            semantic: 0.5,
            recency: 0.3,
            keywords: 0.2
        };

        this.currentWeights = { ...this.defaultWeights };
        this.adjustmentHistory = [];

        this.logger.info('SelfAdjuster initialized with default weights');
    }

    /**
     * Adjust scoring weights based on performance metrics and feedback
     */
    adjustWeights(
        metrics: PerformanceMetrics,
        feedback?: FeedbackSignals
    ): ScoringWeights {
        const adjustments: Partial<ScoringWeights> = {};
        const reasons: string[] = [];

        // 1. Adjust based on relevance score
        if (metrics.relevanceScore < 0.7) {
            // Low relevance - increase semantic weight
            adjustments.semantic = Math.min(this.currentWeights.semantic + 0.1, 0.7);
            adjustments.recency = Math.max(this.currentWeights.recency - 0.05, 0.1);
            reasons.push('low relevance - boosting semantic');
        }

        // 2. Adjust based on average age
        if (metrics.averageAge > 60) {
            // Retrieved memories are too old - increase recency weight
            adjustments.recency = Math.min(this.currentWeights.recency + 0.1, 0.5);
            adjustments.semantic = Math.max(this.currentWeights.semantic - 0.05, 0.3);
            reasons.push('old memories - boosting recency');
        } else if (metrics.averageAge < 7) {
            // Retrieved memories are too recent - might be missing relevant older info
            adjustments.semantic = Math.min(this.currentWeights.semantic + 0.05, 0.6);
            adjustments.recency = Math.max(this.currentWeights.recency - 0.05, 0.2);
            reasons.push('only recent memories - boosting semantic');
        }

        // 3. Adjust based on user feedback
        if (feedback) {
            if (feedback.preferRecent) {
                adjustments.recency = Math.min(this.currentWeights.recency + 0.1, 0.5);
                adjustments.semantic = Math.max(this.currentWeights.semantic - 0.05, 0.3);
                reasons.push('user prefers recent');
            }

            if (feedback.preferSemantic) {
                adjustments.semantic = Math.min(this.currentWeights.semantic + 0.1, 0.7);
                adjustments.keywords = Math.max(this.currentWeights.keywords - 0.05, 0.1);
                reasons.push('user prefers semantic');
            }

            if (feedback.preferKeywords) {
                adjustments.keywords = Math.min(this.currentWeights.keywords + 0.1, 0.4);
                adjustments.semantic = Math.max(this.currentWeights.semantic - 0.05, 0.3);
                reasons.push('user prefers keywords');
            }
        }

        // 4. Apply adjustments
        const newWeights = {
            semantic: adjustments.semantic ?? this.currentWeights.semantic,
            recency: adjustments.recency ?? this.currentWeights.recency,
            keywords: adjustments.keywords ?? this.currentWeights.keywords
        };

        // 5. Normalize to sum to 1.0
        const normalizedWeights = this.normalizeWeights(newWeights);

        // 6. Record adjustment
        if (reasons.length > 0) {
            this.currentWeights = normalizedWeights;
            this.adjustmentHistory.push({
                timestamp: new Date(),
                weights: { ...normalizedWeights },
                reason: reasons.join('; ')
            });

            this.logger.info(`Weights adjusted: ${JSON.stringify(normalizedWeights)} (${reasons.join('; ')})`);
        }

        return this.currentWeights;
    }

    /**
     * Normalize weights to sum to 1.0
     */
    private normalizeWeights(weights: ScoringWeights): ScoringWeights {
        const sum = weights.semantic + weights.recency + weights.keywords;

        if (sum === 0) {
            return { ...this.defaultWeights };
        }

        return {
            semantic: weights.semantic / sum,
            recency: weights.recency / sum,
            keywords: weights.keywords / sum
        };
    }

    /**
     * Get current weights
     */
    getCurrentWeights(): ScoringWeights {
        return { ...this.currentWeights };
    }

    /**
     * Reset to default weights
     */
    resetToDefaults(): void {
        this.currentWeights = { ...this.defaultWeights };
        this.logger.info('Weights reset to defaults');
    }

    /**
     * Get adjustment history
     */
    getAdjustmentHistory(limit: number = 10): Array<any> {
        return this.adjustmentHistory.slice(-limit);
    }

    /**
     * Get statistics for monitoring
     */
    getStats(): any {
        return {
            currentWeights: this.currentWeights,
            defaultWeights: this.defaultWeights,
            totalAdjustments: this.adjustmentHistory.length,
            recentAdjustments: this.getAdjustmentHistory(5)
        };
    }
}

export default new SelfAdjuster();
