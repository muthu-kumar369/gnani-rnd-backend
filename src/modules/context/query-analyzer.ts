// src/modules/context/query-analyzer.ts
import { createContextualLogger } from '../../core/logger/logger.js';
import { Logger } from 'winston';

export interface QueryComplexity {
    score: number; // 0-1, where 1 is most complex
    factors: {
        length: number;
        multiStep: boolean;
        technicalTerms: number;
        contextRequired: boolean;
        ambiguity: number;
    };
    category: 'simple' | 'moderate' | 'complex' | 'very_complex';
}

class QueryAnalyzer {
    private logger: Logger;
    private technicalTerms: Set<string>;

    constructor() {
        this.logger = createContextualLogger({ module: 'QueryAnalyzer' });

        // Common technical terms that indicate complexity
        this.technicalTerms = new Set([
            'algorithm', 'architecture', 'database', 'api', 'framework',
            'implementation', 'optimization', 'performance', 'security',
            'authentication', 'authorization', 'encryption', 'deployment',
            'infrastructure', 'scalability', 'microservices', 'kubernetes',
            'docker', 'ci/cd', 'testing', 'debugging', 'refactoring'
        ]);
    }

    /**
     * Analyze query complexity
     */
    analyzeComplexity(query: string): QueryComplexity {
        const factors = {
            length: this.analyzeLengthComplexity(query),
            multiStep: this.detectMultiStep(query),
            technicalTerms: this.countTechnicalTerms(query),
            contextRequired: this.requiresContext(query),
            ambiguity: this.detectAmbiguity(query)
        };

        // Calculate weighted score
        const score = this.calculateComplexityScore(factors);
        const category = this.categorizeComplexity(score);

        this.logger.debug(`Query complexity: ${score.toFixed(2)} (${category})`);

        return { score, factors, category };
    }

    /**
     * Analyze length complexity (0-1)
     */
    private analyzeLengthComplexity(query: string): number {
        const words = query.split(/\s+/).length;

        // Simple: 1-5 words
        // Moderate: 6-15 words
        // Complex: 16-30 words
        // Very complex: 30+ words

        if (words <= 5) return 0.2;
        if (words <= 15) return 0.5;
        if (words <= 30) return 0.8;
        return 1.0;
    }

    /**
     * Detect multi-step queries
     */
    private detectMultiStep(query: string): boolean {
        const multiStepIndicators = [
            'and then', 'after that', 'next', 'also', 'additionally',
            'furthermore', 'moreover', 'first', 'second', 'finally',
            'step by step', 'one by one'
        ];

        const lowerQuery = query.toLowerCase();
        return multiStepIndicators.some(indicator => lowerQuery.includes(indicator));
    }

    /**
     * Count technical terms
     */
    private countTechnicalTerms(query: string): number {
        const words = query.toLowerCase().split(/\s+/);
        let count = 0;

        for (const word of words) {
            if (this.technicalTerms.has(word)) {
                count++;
            }
        }

        return count;
    }

    /**
     * Detect if query requires context
     */
    private requiresContext(query: string): boolean {
        const contextIndicators = [
            'it', 'that', 'this', 'these', 'those', 'them', 'they',
            'earlier', 'before', 'previously', 'mentioned', 'above',
            'as i said', 'like i told you', 'remember when'
        ];

        const lowerQuery = query.toLowerCase();
        return contextIndicators.some(indicator => lowerQuery.includes(indicator));
    }

    /**
     * Detect ambiguity (0-1)
     */
    private detectAmbiguity(query: string): number {
        const ambiguityIndicators = [
            'maybe', 'perhaps', 'possibly', 'might', 'could',
            'something', 'anything', 'whatever', 'somehow',
            'kind of', 'sort of', 'like', 'or something'
        ];

        const lowerQuery = query.toLowerCase();
        let count = 0;

        for (const indicator of ambiguityIndicators) {
            if (lowerQuery.includes(indicator)) {
                count++;
            }
        }

        // Normalize to 0-1
        return Math.min(count / 3, 1.0);
    }

    /**
     * Calculate overall complexity score
     */
    private calculateComplexityScore(factors: QueryComplexity['factors']): number {
        // Weighted average
        const weights = {
            length: 0.2,
            multiStep: 0.3,
            technicalTerms: 0.2,
            contextRequired: 0.2,
            ambiguity: 0.1
        };

        let score = 0;
        score += factors.length * weights.length;
        score += (factors.multiStep ? 1.0 : 0.0) * weights.multiStep;
        score += Math.min(factors.technicalTerms / 5, 1.0) * weights.technicalTerms;
        score += (factors.contextRequired ? 1.0 : 0.0) * weights.contextRequired;
        score += factors.ambiguity * weights.ambiguity;

        return Math.min(score, 1.0);
    }

    /**
     * Categorize complexity
     */
    private categorizeComplexity(score: number): QueryComplexity['category'] {
        if (score < 0.3) return 'simple';
        if (score < 0.6) return 'moderate';
        if (score < 0.8) return 'complex';
        return 'very_complex';
    }
}

export default new QueryAnalyzer();
