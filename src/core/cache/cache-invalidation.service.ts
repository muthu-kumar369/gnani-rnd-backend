// src/core/cache/cache-invalidation.service.ts
import llmCache from './llm-cache.service.js';
import toolCache from './tool-cache.service.js';
import { createContextualLogger } from '../logger/logger.js';
import { Logger } from 'winston';

export class CacheInvalidationService {
  private logger: Logger;

  constructor() {
    this.logger = createContextualLogger({ module: 'CacheInvalidation' });
  }

  // Invalidate cache when user updates preferences
  async onUserPreferencesUpdate(userId: string): Promise<void> {
    this.logger.info('Invalidating cache for user preferences update', { userId });
    
    // Clear LLM cache (preferences might affect responses)
    await llmCache.clear();
  }

  // Invalidate tool cache when data changes
  async onDataUpdate(toolName: string): Promise<void> {
    this.logger.info('Invalidating tool cache for data update', { toolName });
    
    await toolCache.invalidate(toolName);
  }

  // Scheduled cache cleanup (run daily)
  async scheduledCleanup(): Promise<void> {
    this.logger.info('Running scheduled cache cleanup');
    
    // Get cache stats
    const llmStats = await llmCache.getStats();
    
    this.logger.info('Cache statistics', {
      llm: llmStats
    });

    // Redis handles TTL expiration automatically
    // This is just for logging and monitoring
  }

  // Get all cache statistics
  async getAllStats(): Promise<{
    llm: { hits: number; misses: number; hitRate: number };
    tools: { [toolName: string]: { hits: number; misses: number; hitRate: number } };
  }> {
    const llmStats = await llmCache.getStats();
    
    // Get stats for common tools
    const toolNames = ['web_search', 'file_read', 'weather', 'calculator', 'get_current_time'];
    const toolStats: any = {};
    
    for (const toolName of toolNames) {
      toolStats[toolName] = await toolCache.getStats(toolName);
    }

    return {
      llm: llmStats,
      tools: toolStats
    };
  }
}

export default new CacheInvalidationService();
