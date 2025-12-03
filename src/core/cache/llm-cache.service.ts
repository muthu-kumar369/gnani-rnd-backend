// src/core/cache/llm-cache.service.ts
import { createContextualLogger } from '../logger/logger.js';
import redisClient from '../../config/redis.config.js';
import crypto from 'crypto';
import { Logger } from 'winston';

export class LLMCacheService {
  private logger: Logger;
  private DEFAULT_TTL = 3600; // 1 hour
  private keyPrefix = 'llm:cache:';

  constructor() {
    this.logger = createContextualLogger({ module: 'LLMCache' });
  }

  async get(prompt: string, context?: any): Promise<string | null> {
    try {
      const key = this.generateKey(prompt, context);
      const cached = await redisClient.get(key);

      if (cached) {
        this.logger.info('LLM cache hit', { keyHash: this.hashKey(key) });
        await this.incrementStat('hits');
        return cached;
      }

      this.logger.debug('LLM cache miss', { keyHash: this.hashKey(key) });
      await this.incrementStat('misses');
      return null;

    } catch (error: any) {
      this.logger.error('Error getting from LLM cache', { error: error.message });
      return null;
    }
  }

  async set(prompt: string, response: string, context?: any, ttl?: number): Promise<void> {
    try {
      const key = this.generateKey(prompt, context);
      await redisClient.setex(key, ttl || this.DEFAULT_TTL, response);

      this.logger.debug('LLM response cached', {
        keyHash: this.hashKey(key),
        ttl: ttl || this.DEFAULT_TTL,
        responseLength: response.length
      });

    } catch (error: any) {
      this.logger.error('Error setting LLM cache', { error: error.message });
    }
  }

  async invalidate(prompt: string, context?: any): Promise<void> {
    try {
      const key = this.generateKey(prompt, context);
      await redisClient.del(key);

      this.logger.info('LLM cache invalidated', { keyHash: this.hashKey(key) });

    } catch (error: any) {
      this.logger.error('Error invalidating LLM cache', { error: error.message });
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = await redisClient.keys(`${this.keyPrefix}*`);
      if (keys.length > 0) {
        await redisClient.del(...keys);
        this.logger.info('LLM cache cleared', { count: keys.length });
      }
    } catch (error: any) {
      this.logger.error('Error clearing LLM cache', { error: error.message });
    }
  }

  private generateKey(prompt: string, context?: any): string {
    // Include only last 3 messages from context to avoid cache misses
    const contextStr = context?.recentMessages 
      ? JSON.stringify(context.recentMessages.slice(-3))
      : '';
    const combined = `${prompt}${contextStr}`;
    const hash = crypto.createHash('sha256').update(combined).digest('hex');
    return `${this.keyPrefix}${hash}`;
  }

  private hashKey(key: string): string {
    return crypto.createHash('md5').update(key).digest('hex').substring(0, 8);
  }

  private async incrementStat(stat: 'hits' | 'misses'): Promise<void> {
    try {
      await redisClient.incr(`llm:cache:stats:${stat}`);
    } catch (error: any) {
      // Ignore stat errors
    }
  }

  async getStats(): Promise<{ hits: number; misses: number; hitRate: number }> {
    try {
      const hits = parseInt(await redisClient.get('llm:cache:stats:hits') || '0');
      const misses = parseInt(await redisClient.get('llm:cache:stats:misses') || '0');
      const total = hits + misses;
      const hitRate = total > 0 ? hits / total : 0;

      return { hits, misses, hitRate };
    } catch (error: any) {
      this.logger.error('Error getting cache stats', { error: error.message });
      return { hits: 0, misses: 0, hitRate: 0 };
    }
  }
}

export default new LLMCacheService();
