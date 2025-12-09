import { createContextualLogger } from '../logger/logger.js';
import metrics from '../monitoring/metrics.js';

const logger = createContextualLogger({ module: 'PIIDetector' });

export interface PIIMatch {
    type: 'email' | 'phone' | 'ssn' | 'credit_card' | 'address' | 'ip_address';
    value: string;
    start: number;
    end: number;
    confidence: number;
}

export class PIIDetectorService {
    // Regex patterns for common PII
    private readonly patterns = {
        email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        phone: /\b(\+\d{1,3}[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b/g,
        ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
        creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
        ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    };

    /**
     * Detect PII in text
     */
    detectPII(text: string): PIIMatch[] {
        const matches: PIIMatch[] = [];

        for (const [type, pattern] of Object.entries(this.patterns)) {
            const regex = new RegExp(pattern);
            let match;

            while ((match = regex.exec(text)) !== null) {
                matches.push({
                    type: type as any,
                    value: match[0],
                    start: match.index,
                    end: match.index + match[0].length,
                    confidence: this.calculateConfidence(type, match[0]),
                });
            }
        }

        return matches;
    }

    /**
     * Mask PII in text
     */
    maskPII(text: string, maskChar: string = '*'): string {
        const matches = this.detectPII(text);

        if (matches.length === 0) {
            return text;
        }

        let maskedText = text;

        // Sort matches by start position (descending) to avoid index issues
        matches.sort((a, b) => b.start - a.start);

        for (const match of matches) {
            const masked = this.maskValue(match.value, match.type, maskChar);
            maskedText = maskedText.substring(0, match.start) +
                masked +
                maskedText.substring(match.end);
        }

        return maskedText;
    }

    /**
     * Mask PII in object (recursively)
     */
    maskPIIInObject(obj: any): any {
        if (typeof obj === 'string') {
            return this.maskPII(obj);
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.maskPIIInObject(item));
        }

        if (obj && typeof obj === 'object') {
            const masked: any = {};
            for (const [key, value] of Object.entries(obj)) {
                masked[key] = this.maskPIIInObject(value);
            }
            return masked;
        }

        return obj;
    }

    /**
     * Check if text contains PII
     */
    containsPII(text: string): boolean {
        return this.detectPII(text).length > 0;
    }

    /**
     * Mask specific value based on type
     */
    private maskValue(value: string, type: string, maskChar: string): string {
        switch (type) {
            case 'email':
                const [local, domain] = value.split('@');
                if (!local || !domain) return maskChar.repeat(value.length);
                return `${local[0]}${maskChar.repeat(local.length - 1)}@${domain}`;

            case 'phone':
                const digits = value.replace(/\D/g, '');
                return `***-***-${digits.slice(-4)}`;

            case 'ssn':
                return `***-**-${value.slice(-4)}`;

            case 'creditCard':
                const cardDigits = value.replace(/\D/g, '');
                return `****-****-****-${cardDigits.slice(-4)}`;

            case 'ipAddress':
                const parts = value.split('.');
                return `***.***.***. ${parts[3]}`;

            default:
                return maskChar.repeat(value.length);
        }
    }

    /**
     * Calculate confidence score for PII match
     */
    private calculateConfidence(type: string, value: string): number {
        switch (type) {
            case 'email':
                // Higher confidence if has common TLD
                return value.match(/\.(com|org|net|edu|gov)$/) ? 0.95 : 0.85;

            case 'phone':
                // Higher confidence if has country code
                return value.startsWith('+') ? 0.95 : 0.80;

            case 'ssn':
                // SSN pattern is quite specific
                return 0.90;

            case 'creditCard':
                // Would need Luhn algorithm for higher confidence
                return 0.75;

            case 'ipAddress':
                // Check if valid IP range
                const parts = value.split('.').map(Number);
                const isValid = parts.every(p => p >= 0 && p <= 255);
                return isValid ? 0.90 : 0.60;

            default:
                return 0.70;
        }
    }
}

// Singleton instance
export const piiDetector = new PIIDetectorService();
