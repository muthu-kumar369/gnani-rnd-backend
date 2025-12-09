import { createContextualLogger } from '../logger/logger.js';
import metrics from '../monitoring/metrics.js';

const logger = createContextualLogger({ module: 'ContentFilter' });

export interface FilterResult {
    allowed: boolean;
    reason?: string;
    categories: string[];
    confidence: number;
    flaggedTerms?: string[];
}

export class ContentFilterService {
    // Banned content patterns
    private readonly bannedPatterns = [
        { pattern: /\b(kill|murder|harm|attack|violence)\s+(someone|people|person)/i, category: 'violence', severity: 'high' },
        { pattern: /\b(how to|ways to|methods to)\s+(harm|hurt|kill)/i, category: 'violence', severity: 'high' },
        { pattern: /\b(suicide|self-harm|end my life)/i, category: 'self-harm', severity: 'critical' },
        { pattern: /\b(illegal drugs|buy drugs|sell drugs|drug dealer)/i, category: 'illegal-activity', severity: 'high' },
        { pattern: /\b(hack|crack|exploit|bypass security)/i, category: 'hacking', severity: 'medium' },
        { pattern: /\b(racist|sexist|homophobic|hate speech)/i, category: 'hate-speech', severity: 'high' },
    ];

    // Sensitive topics (warning, not blocking)
    private readonly sensitiveTopics = [
        'medical advice',
        'legal advice',
        'financial advice',
        'political opinion',
        'religious debate',
    ];

    // Explicit content patterns
    private readonly explicitPatterns = [
        /\b(explicit sexual|pornographic|nsfw)\b/i,
        /\b(child\s+(?:abuse|exploitation|pornography))\b/i,
    ];

    /**
     * Filter input text
     */
    async filterInput(text: string, userId?: string): Promise<FilterResult> {
        const categories: string[] = [];
        const flaggedTerms: string[] = [];
        let highestSeverity = 'low';

        // Check banned patterns
        for (const { pattern, category, severity } of this.bannedPatterns) {
            const match = text.match(pattern);
            if (match) {
                categories.push(category);
                flaggedTerms.push(match[0]);
                if (this.compareSeverity(severity, highestSeverity) > 0) {
                    highestSeverity = severity;
                }
            }
        }

        // Check explicit content
        for (const pattern of this.explicitPatterns) {
            const match = text.match(pattern);
            if (match) {
                categories.push('explicit-content');
                flaggedTerms.push(match[0]);
                highestSeverity = 'critical';
            }
        }

        const allowed = categories.length === 0 || highestSeverity === 'low';

        if (!allowed) {
            logger.warn('Content filtered', {
                userId,
                categories,
                flaggedTerms,
                severity: highestSeverity,
            });

            metrics.incrementErrors('content_filtered', 'security');
        }

        return {
            allowed,
            reason: allowed ? undefined : `Content violates safety policies: ${categories.join(', ')}`,
            categories,
            confidence: this.calculateConfidence(categories.length, flaggedTerms.length),
            flaggedTerms,
        };
    }

    /**
     * Filter output text (LLM responses)
     */
    async filterOutput(text: string): Promise<FilterResult> {
        // Similar logic but may have different thresholds
        return this.filterInput(text);
    }

    /**
     * Check for sensitive topics (warning only)
     */
    checkSensitiveTopics(text: string): string[] {
        const found: string[] = [];
        const lowerText = text.toLowerCase();

        for (const topic of this.sensitiveTopics) {
            if (lowerText.includes(topic.toLowerCase())) {
                found.push(topic);
            }
        }

        return found;
    }

    /**
     * Sanitize potentially harmful content
     */
    sanitizeContent(text: string): string {
        let sanitized = text;

        // Remove potential script injections
        sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
        sanitized = sanitized.replace(/javascript:/gi, '');
        sanitized = sanitized.replace(/on\w+\s*=/gi, '');

        return sanitized;
    }

    /**
     * Compare severity levels
     */
    private compareSeverity(a: string, b: string): number {
        const levels = { low: 1, medium: 2, high: 3, critical: 4 };
        return (levels[a as keyof typeof levels] || 0) - (levels[b as keyof typeof levels] || 0);
    }

    /**
     * Calculate confidence score
     */
    private calculateConfidence(categoryCount: number, flaggedTermCount: number): number {
        if (categoryCount === 0) return 1.0;
        if (categoryCount >= 3) return 0.95;
        if (flaggedTermCount >= 2) return 0.90;
        return 0.85;
    }
}

// Singleton instance
export const contentFilter = new ContentFilterService();
