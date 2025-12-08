// src/utils/retry.ts
import { createContextualLogger } from '../core/logger/logger.js';
import { AppError } from '../shared/errors/error-types.js';

const logger = createContextualLogger({ module: 'RetryUtil' });

// Stage 3: Enhanced retry options
export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  exponentialBase: number;
  jitter: boolean;
  retryableErrors?: string[]; // Error codes that should trigger retry
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 10000,
  exponentialBase: 2,
  jitter: true
};

// Stage 3: Enhanced retry with backoff and jitter
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
  operationName: string = 'Operation'
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      logger.debug(`${operationName}: Attempt ${attempt + 1}/${opts.maxRetries + 1}`);
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if error is retryable
      if (error instanceof AppError && !error.isRetryable) {
        logger.warn(`${operationName}: Non-retryable error, aborting: ${error.message}`);
        throw error;
      }

      // Check if we've exhausted retries
      if (attempt === opts.maxRetries) {
        logger.error(`${operationName}: Max retries (${opts.maxRetries}) exceeded`);
        break;
      }

      // Calculate delay with exponential backoff
      const exponentialDelay = opts.baseDelayMs * Math.pow(opts.exponentialBase, attempt);
      let delay = Math.min(exponentialDelay, opts.maxDelayMs);

      // Add jitter to prevent thundering herd
      if (opts.jitter) {
        delay = delay * (0.5 + Math.random() * 0.5);
      }

      logger.warn(`${operationName}: Attempt ${attempt + 1} failed: ${error.message}. Retrying in ${Math.round(delay)}ms...`);

      // Call onRetry callback if provided
      if (opts.onRetry) {
        opts.onRetry(attempt + 1, error);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Stage 3: Specialized retry for database operations
export async function retryDatabaseOperation<T>(
  fn: () => Promise<T>,
  operationName: string = 'Database Operation'
): Promise<T> {
  return retryWithBackoff(fn, {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 5000,
    onRetry: (attempt, error) => {
      logger.warn(`Database retry attempt ${attempt}: ${error.message}`);
    }
  }, operationName);
}

// Stage 3: Specialized retry for network operations
export async function retryNetworkOperation<T>(
  fn: () => Promise<T>,
  operationName: string = 'Network Operation'
): Promise<T> {
  return retryWithBackoff(fn, {
    maxRetries: 5,
    baseDelayMs: 500,
    maxDelayMs: 10000,
    jitter: true
  }, operationName);
}

// Stage 3: Specialized retry for LLM operations
export async function retryLLMOperation<T>(
  fn: () => Promise<T>,
  operationName: string = 'LLM Operation'
): Promise<T> {
  return retryWithBackoff(fn, {
    maxRetries: 2,
    baseDelayMs: 1000,
    maxDelayMs: 5000,
    jitter: true
  }, operationName);
}
