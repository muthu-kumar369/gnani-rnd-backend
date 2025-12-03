// src/core/cache/tool-cache.service.ts
import { createContextualLogger } from '../logger/logger.js';
import redisClient from '../../config/redis.config.js';
import crypto from 'crypto';
import { Logger } from 'winston';

export class ToolCacheService {
  private logger: Logger;
  private keyPrefix = 'tool:cache:';
  private ttlMap: Map<string, number> = new Map([
    ['web_search', 3600],      // 1 hour
    ['file_read', 300],         // 5 minutes
    ['weather', 1800],          // 30 minutes
    ['calculator', 86400],      // 24 hours (deterministic)
    ['get_current_time', 60],   // 1 minute
    ['default', 1800]           // 30 minutes
  ]);

  constructor() {
    this.logger = createContextualLogger({ module: 'ToolCache' });
  }

  async get(toolName: string, params: any): Promise<any | null> {
    try {
      const key = this.generateKey(toolName, params);
      const cached = await redisClient.get(key);

      if (cached) {
        this.logger.info('Tool cache hit', { tool: toolName });
        await this.incrementStat(toolName, 'hits');
        return JSON.parse(cached);
      }

      this.logger.debug('Tool cache miss', { tool: toolName });
      await this.incrementStat(toolName, 'misses');
      return null;

    } catch (error: any) {
      this.logger.error('Error getting from tool cache', { 
        tool: toolName, 
        error: error.message 
      });
      return null;
    }
  }

  async set(toolName: string, params: any, result: any): Promise<void> {
    try {
      const key = this.generateKey(toolName, params);
      const ttl = this.ttlMap.get(toolName) || this.ttlMap.get('default')!;

      await redisClient.setex(key, ttl, JSON.stringify(result));

      this.logger.debug('Tool result cached', { 
        tool: toolName, 
        ttl,
        resultSize: JSON.stringify(result).length
      });

    } catch (error: any) {
      this.logger.error('Error setting tool cache', { 
        tool: toolName, 
        error: error.message 
      });
    }
  }

  async invalidate(toolName: string, params?: any): Promise<void> {
    try {
      if (params) {
        const key = this.generateKey(toolName, params);
        await redisClient.del(key);
      } else {
        // Invalidate all cache entries for this tool
        const pattern = `${this.keyPrefix}${toolName}:*`;
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      }

      this.logger.info('Tool cache invalidated', { tool: toolName });

    } catch (error: any) {
      this.logger.error('Error invalidating tool cache', { 
        tool: toolName, 
        error: error.message 
      });
    }
  }

  private generateKey(toolName: string, params: any): string {
    const paramsStr = JSON.stringify(params);
    const hash = crypto.createHash('sha256').update(paramsStr).digest('hex');
    return `${this.keyPrefix}${toolName}:${hash}`;
  }

  setTTL(toolName: string, ttl: number): void {
    this.ttlMap.set(toolName, ttl);
    this.logger.info('Tool cache TTL updated', { tool: toolName, ttl });
  }

  private async incrementStat(toolName: string, stat: 'hits' | 'misses'): Promise<void> {
    try {
      await redisClient.incr(`tool:cache:stats:${toolName}:${stat}`);
    } catch (error: any) {
      // Ignore stat errors
    }
  }

  async getStats(toolName?: string): Promise<{ hits: number; misses: number; hitRate: number }> {
    try {
      const prefix = toolName ? `tool:cache:stats:${toolName}` : 'tool:cache:stats';
      const hits = parseInt(await redisClient.get(`${prefix}:hits`) || '0');
      const misses = parseInt(await redisClient.get(`${prefix}:misses`) || '0');
      const total = hits + misses;
      const hitRate = total > 0 ? hits / total : 0;

      return { hits, misses, hitRate };
    } catch (error: any) {
      this.logger.error('Error getting tool cache stats', { error: error.message });
      return { hits: 0, misses: 0, hitRate: 0 };
    }
  }
}

export default new ToolCacheService();
