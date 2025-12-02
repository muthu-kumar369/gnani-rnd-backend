import { createContextualLogger } from '../core/logger/logger.js';

const logger = createContextualLogger({ module: 'RetryUtils' });

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
  context = 'Operation'
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (i === maxRetries - 1) {
        logger.error(`${context} failed after ${maxRetries} attempts: ${error.message}`);
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, i); // Exponential backoff
      logger.warn(`${context} failed (attempt ${i + 1}/${maxRetries}). Retrying in ${delay}ms... Error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error(`${context} failed: Max retries exceeded`);
}
