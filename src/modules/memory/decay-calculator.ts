// src/modules/memory/decay-calculator.ts
import { createContextualLogger } from '../../core/logger/logger.js';
import { Logger } from 'winston';

export interface DecayConfig {
    halfLifeDays: number;      // Time for memory to decay to 50% relevance
    accessBoostFactor: number;  // How much each access increases relevance
    minDecayScore: number;      // Minimum score after decay (prevents total loss)
}

export interface MemoryDecayResult {
    originalScore: number;
    decayedScore: number;
    timeDecay: number;
    accessBoost: number;
    finalScore: number;
}

class DecayCalculator {
    private logger: Logger;
    private config: DecayConfig;

    constructor() {
        this.logger = createContextualLogger({ module: 'DecayCalculator' });

        // Default configuration
        this.config = {
            halfLifeDays: 30,           // Memories decay to 50% after 30 days
            accessBoostFactor: 0.1,     // Each access adds 10% boost
            minDecayScore: 0.1          // Minimum 10% of original score
        };

        this.logger.info(`DecayCalculator initialized with half-life: ${this.config.halfLifeDays} days`);
    }

    /**
     * Apply time-based and access-based decay to memory score
     */
    applyDecay(
        originalScore: number,
        ageInDays: number,
        accessCount: number = 0
    ): MemoryDecayResult {
        // 1. Time-based exponential decay
        // Formula: score * e^(-λt) where λ = ln(2) / half-life
        const decayConstant = Math.LN2 / this.config.halfLifeDays;
        const timeDecay = Math.exp(-decayConstant * ageInDays);

        // 2. Access frequency boost (logarithmic to prevent over-boosting)
        // Formula: 1 + (boost_factor * log(access_count + 1))
        const accessBoost = 1 + (this.config.accessBoostFactor * Math.log(accessCount + 1));

        // 3. Calculate final score
        let finalScore = originalScore * timeDecay * accessBoost;

        // 4. Apply minimum threshold
        const minScore = originalScore * this.config.minDecayScore;
        finalScore = Math.max(finalScore, minScore);

        // 5. Cap at original score (decay can't increase score beyond original)
        finalScore = Math.min(finalScore, originalScore);

        this.logger.debug(
            `Decay applied: original=${originalScore.toFixed(3)}, ` +
            `age=${ageInDays}d, accesses=${accessCount}, ` +
            `final=${finalScore.toFixed(3)}`
        );

        return {
            originalScore,
            decayedScore: originalScore * timeDecay,
            timeDecay,
            accessBoost,
            finalScore
        };
    }

    /**
     * Calculate age in days from timestamp
     */
    calculateAge(timestamp: Date): number {
        const now = new Date();
        const ageMs = now.getTime() - timestamp.getTime();
        return ageMs / (1000 * 60 * 60 * 24); // Convert to days
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<DecayConfig>): void {
        this.config = { ...this.config, ...newConfig };
        this.logger.info(`Decay config updated: ${JSON.stringify(this.config)}`);
    }

    /**
     * Get current configuration
     */
    getConfig(): DecayConfig {
        return { ...this.config };
    }

    /**
     * Calculate expected decay for given age
     */
    getExpectedDecay(ageInDays: number): number {
        const decayConstant = Math.LN2 / this.config.halfLifeDays;
        return Math.exp(-decayConstant * ageInDays);
    }

    /**
     * Get statistics for monitoring
     */
    getStats(): any {
        return {
            halfLifeDays: this.config.halfLifeDays,
            accessBoostFactor: this.config.accessBoostFactor,
            minDecayScore: this.config.minDecayScore,
            decayAt7Days: this.getExpectedDecay(7).toFixed(3),
            decayAt30Days: this.getExpectedDecay(30).toFixed(3),
            decayAt90Days: this.getExpectedDecay(90).toFixed(3)
        };
    }
}

export default new DecayCalculator();
