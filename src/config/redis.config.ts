// Redis configuration
import { Redis } from 'ioredis';
import { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB } from './env.config.js';
import { CircuitBreaker } from '../core/reliability/circuit-breaker.js';
import { createContextualLogger } from '../core/logger/logger.js';

const logger = createContextualLogger({ module: 'Redis' });

// Stage 2: Redis circuit breaker
export const redisCircuitBreaker = new CircuitBreaker('Redis', {
  failureThreshold: 5,
  resetTimeoutMs: 20000,
  requestTimeoutMs: 5000
});

// Create Redis client instance
const redisClient = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD || undefined,
  db: REDIS_DB,
  // Production Tuning
  retryStrategy: (times: number) => {
    if (times > 3) {
      logger.error('Redis max retries exceeded');
      return null;
    }
    // Exponential backoff with jitter
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
  reconnectOnError: (err: Error) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      // Only reconnect when the error is "READONLY"
      return true;
    }
    return false;
  },
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  keepAlive: 10000, // Send keep-alive every 10 seconds
  connectTimeout: 10000, // 10 seconds connection timeout
  family: 4, // IPv4
});

// Event handlers
redisClient.on('connect', () => {
  logger.info('Redis client connected');
});

redisClient.on('ready', () => {
  logger.info('Redis client ready');
});

redisClient.on('error', (err: Error) => {
  logger.error(`Redis client error: ${err.message}`);
});

redisClient.on('close', () => {
  logger.warn('Redis client connection closed');
});

redisClient.on('reconnecting', () => {
  logger.info('Redis client reconnecting...');
});

// Stage 2: Wrapper for Redis operations with fallback
export async function withRedisCircuitBreaker<T>(
  operation: () => Promise<T>,
  fallback?: () => T
): Promise<T> {
  try {
    return await redisCircuitBreaker.execute(operation);
  } catch (error: any) {
    logger.warn(`Redis operation failed: ${error.message}`);
    if (fallback) {
      logger.info('Using fallback for Redis operation');
      return fallback();
    }
    throw error;
  }
}

export { redisClient };
export default redisClient;
