import { Logger } from 'winston';
import { createContextualLogger } from '../logger/logger.js';

const logger = createContextualLogger({ module: 'ErrorRecovery' });

export interface RecoveryOptions<T> {
    retries?: number;
    delay?: number;
    fallback?: () => Promise<T>;
    onError?: (error: Error, attempt: number) => void;
    context?: string; // e.g. "LLM Call", "DB Query"
}

/**
 * Execute a function with retry logic and fallback support
 */
export async function executeWithRecovery<T>(
    fn: () => Promise<T>,
    options: RecoveryOptions<T> = {}
): Promise<T> {
    const {
        retries = 3,
        delay = 1000,
        fallback,
        onError,
        context = 'Operation'
    } = options;

    let lastError: Error;

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;

            if (onError) {
                onError(error, attempt);
            }

            if (attempt <= retries) {
                const waitTime = delay * Math.pow(2, attempt - 1); // Exponential backoff
                logger.warn(`${context} failed (Attempt ${attempt}/${retries}). Retrying in ${waitTime}ms...`, {
                    error: error.message
                });
                await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
                logger.error(`${context} failed after ${retries} retries`, {
                    error: error.message,
                    stack: error.stack
                });
            }
        }
    }

    // All retries failed, try fallback
    if (fallback) {
        try {
            logger.info(`${context}: Executing fallback strategy...`);
            return await fallback();
        } catch (fallbackError: any) {
            logger.error(`${context}: Fallback also failed`, {
                error: fallbackError.message
            });
            throw lastError!; // Throw original error if fallback fails
        }
    }

    throw lastError!;
}
