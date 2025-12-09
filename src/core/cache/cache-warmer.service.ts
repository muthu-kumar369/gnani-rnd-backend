import { cacheService } from './cache.service.js';
import { createContextualLogger } from '../logger/logger.js';

export class CacheWarmer {
    private readonly logger = createContextualLogger({ module: 'CacheWarmer' });

    /**
     * Warm cache on application startup
     */
    async warmCache(): Promise<void> {
        this.logger.info('Starting cache warming...');

        const startTime = Date.now();

        await Promise.all([
            this.warmSystemPrompts(),
            this.warmModelConfigs(),
            this.warmCommonResponses(),
        ]);

        const duration = Date.now() - startTime;
        this.logger.info(`Cache warming complete in ${duration}ms`);
    }

    /**
     * Warm system prompts
     */
    private async warmSystemPrompts(): Promise<void> {
        // Pre-load common system prompts
        const prompts = [
            { key: 'default', value: 'You are a helpful AI assistant.' },
            { key: 'helpful-assistant', value: 'You are a helpful, respectful and honest assistant.' },
            { key: 'code-assistant', value: 'You are an expert programming assistant.' },
            { key: 'creative-writer', value: 'You are a creative writing assistant.' },
        ];

        for (const prompt of prompts) {
            await cacheService.set(
                `system-prompt:${prompt.key}`,
                prompt.value,
                3600 // 1 hour
            );
        }

        this.logger.debug(`Warmed ${prompts.length} system prompts`);
    }

    /**
     * Warm model configurations
     */
    private async warmModelConfigs(): Promise<void> {
        // Pre-load model configurations
        const models = [
            { name: 'llama3.1', config: { temperature: 0.7, maxTokens: 2048 } },
            { name: 'llama3.2', config: { temperature: 0.7, maxTokens: 2048 } },
            { name: 'mistral', config: { temperature: 0.7, maxTokens: 4096 } },
        ];

        for (const model of models) {
            await cacheService.set(
                `model-config:${model.name}`,
                JSON.stringify(model.config),
                3600 // 1 hour
            );
        }

        this.logger.debug(`Warmed ${models.length} model configurations`);
    }

    /**
     * Warm common responses
     */
    private async warmCommonResponses(): Promise<void> {
        // Pre-compute common greetings and responses
        const commonResponses = [
            { key: 'greeting:hello', value: 'Hello! How can I help you today?' },
            { key: 'greeting:hi', value: 'Hi there! What can I do for you?' },
            { key: 'help:capabilities', value: 'I can help you with various tasks including answering questions, writing code, and more.' },
        ];

        for (const response of commonResponses) {
            await cacheService.set(
                `common-response:${response.key}`,
                response.value,
                1800 // 30 minutes
            );
        }

        this.logger.debug(`Warmed ${commonResponses.length} common responses`);
    }

    /**
     * Warm user-specific cache (called when user logs in)
     */
    async warmUserCache(userId: string): Promise<void> {
        this.logger.debug(`Warming cache for user: ${userId}`);

        // Pre-load user preferences, recent conversations, etc.
        // This would integrate with actual services
        await cacheService.set(
            `user-cache-warmed:${userId}`,
            'true',
            300 // 5 minutes
        );
    }
}

// Export singleton instance
export const cacheWarmer = new CacheWarmer();
