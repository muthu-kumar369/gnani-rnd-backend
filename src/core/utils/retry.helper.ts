// gnani-rnd-backend/src/core/utils/retry.helper.ts

import { createContextualLogger } from '../logger/logger.js';

const logger = createContextualLogger({ module: 'RetryHelper' });

export interface RetryOptions {
    maxAttempts?: number;
    delayMs?: number;
    backoffMultiplier?: number;
    maxDelayMs?: number;
    onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Check if error is transient and should be retried
 */
export function isTransientError(error: any): boolean {
    if (!error) return false;

    const transientErrors = [
        'ECONNRESET',
        'ETIMEDOUT',
        'ECONNREFUSED',
        'ENOTFOUND',
        'ENETUNREACH',
        'EAI_AGAIN',
        'EPIPE'
    ];

    // Check error code
    if (error.code && transientErrors.includes(error.code)) {
        return true;
    }

    // Check error message
    const message = error.message?.toLowerCase() || '';
    const transientMessages = [
        'timeout',
        'network',
        'connection',
        'econnreset',
        'socket hang up',
        'rate limit',
        'too many requests'
    ];

    return transientMessages.some(msg => message.includes(msg));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxAttempts = 3,
        delayMs = 1000,
        backoffMultiplier = 2,
        maxDelayMs = 30000,
        onRetry
    } = options;

    let lastError: Error;
    let currentDelay = delayMs;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;

            // Don't retry on last attempt
            if (attempt === maxAttempts) {
                break;
            }

            // Only retry transient errors
            if (!isTransientError(error)) {
                throw error;
            }

            logger.warn('Retrying after error', {
                attempt,
                maxAttempts,
                error: error.message,
                delayMs: currentDelay
            });

            // Call retry callback if provided
            if (onRetry) {
                onRetry(attempt, error);
            }

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, currentDelay));

            // Increase delay for next attempt (exponential backoff)
            currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelayMs);
        }
    }

    throw lastError!;
}

/**
 * Retry with custom retry condition
 */
export async function retryWithCondition<T>(
    fn: () => Promise<T>,
    shouldRetry: (error: Error, attempt: number) => boolean,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxAttempts = 3,
        delayMs = 1000,
        backoffMultiplier = 2,
        maxDelayMs = 30000,
        onRetry
    } = options;

    let lastError: Error;
    let currentDelay = delayMs;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;

            if (attempt === maxAttempts || !shouldRetry(error, attempt)) {
                throw error;
            }

            logger.warn('Retrying with custom condition', {
                attempt,
                maxAttempts,
                error: error.message,
                delayMs: currentDelay
            });

            if (onRetry) {
                onRetry(attempt, error);
            }

            await new Promise(resolve => setTimeout(resolve, currentDelay));
            currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelayMs);
        }
    }

    throw lastError!;
}

export default { retry, retryWithCondition, isTransientError };
