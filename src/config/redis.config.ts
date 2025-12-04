// Redis configuration
import { Redis } from 'ioredis';
import { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB } from './env.config.js';

// Create Redis client instance
const redisClient = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD || undefined,
  db: REDIS_DB,
  // Production Tuning
  retryStrategy: (times: number) => {
    // Exponential backoff with jitter
    const delay = Math.min(times * 50, 2000);
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
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: true,
  keepAlive: 10000, // Send keep-alive every 10 seconds
  connectTimeout: 10000, // 10 seconds connection timeout
  family: 4, // IPv4
});

// Event handlers
redisClient.on('connect', () => {
  console.log('✓ Redis client connected');
});

redisClient.on('ready', () => {
  console.log('✓ Redis client ready');
});

redisClient.on('error', (err: Error) => {
  console.error('✗ Redis client error:', err);
});

redisClient.on('close', () => {
  console.log('Redis client connection closed');
});

redisClient.on('reconnecting', () => {
  console.log('Redis client reconnecting...');
});

export { redisClient };
export default redisClient;