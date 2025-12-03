// src/shared/utils/retry.ts
import { createContextualLogger } from '../../core/logger/logger.js';

const logger = createContextualLogger({ module: 'RetryUtil' });

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: Error) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    shouldRetry = () => true
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry
      if (!shouldRetry(lastError)) {
        logger.warn('Error not retryable', { error: lastError.message });
        throw lastError;
      }

      // Check if we've exhausted retries
      if (attempt === maxRetries) {
        logger.error('Max retries exhausted', {
          attempts: attempt,
          error: lastError.message
        });
        throw lastError;
      }

      // Log retry attempt
      logger.warn('Retrying after error', {
        attempt,
        maxRetries,
        delay,
        error: lastError.message
      });

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));

      // Exponential backoff
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError!;
}

// Helper for specific error types
export function isRetryableError(error: Error): boolean {
  const retryablePatterns = [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'network',
    'timeout',
    'temporarily unavailable',
    'ECONNRESET',
    'EPIPE'
  ];

  return retryablePatterns.some(pattern =>
    error.message.toLowerCase().includes(pattern.toLowerCase())
  );
}
