// Redis configuration
import { Redis } from 'ioredis';
import { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB } from './env.config.js';

// Create Redis client instance
const redisClient = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD || undefined,
  db: REDIS_DB,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError: (err: Error) => {
    console.error('Redis reconnect on error:', err);
    return true;
  },
  lazyConnect: true, // Don't connect immediately, wait for explicit connect() call
  maxRetriesPerRequest: null, // Required for BullMQ
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