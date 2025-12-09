import { WarmingStrategy } from './cache-warming.service.js';
import redisClient from '../../config/redis.config.js';
import { templateService } from '../../modules/template/template.service.js';
import { toolService } from '../../modules/tool/tool.service.js';
import { createContextualLogger } from '../logger/logger.js';

const logger = createContextualLogger({ module: 'WarmingStrategies' });

/**
 * Warm popular templates
 */
export const warmTemplatesStrategy: WarmingStrategy = {
    name: 'warm-templates',
    interval: 10 * 60 * 1000, // 10 minutes
    execute: async () => {
        try {
            // Seed defaults which returns void, so we'll just warm system templates
            await templateService.seedDefaults();
            logger.debug('Warmed default templates');
        } catch (error: any) {
            logger.error('Failed to warm templates', { error: error.message });
        }
    },
};

/**
 * Warm frequently used tools
 */
export const warmToolsStrategy: WarmingStrategy = {
    name: 'warm-tools',
    interval: 15 * 60 * 1000, // 15 minutes
    execute: async () => {
        try {
            const tools = await toolService.findAll();

            await redisClient.setex(
                'tools:available',
                15 * 60, // 15 minutes
                JSON.stringify(tools)
            );

            logger.debug(`Warmed ${tools.length} tools`);
        } catch (error: any) {
            logger.error('Failed to warm tools', { error: error.message });
        }
    },
};

/**
 * Warm system configuration
 */
export const warmSystemConfigStrategy: WarmingStrategy = {
    name: 'warm-system-config',
    interval: 30 * 60 * 1000, // 30 minutes
    execute: async () => {
        try {
            // Warm frequently accessed system data
            const systemData = {
                timestamp: Date.now(),
                status: 'active',
            };

            await redisClient.setex(
                'system:config',
                30 * 60, // 30 minutes
                JSON.stringify(systemData)
            );

            logger.debug('Warmed system configuration');
        } catch (error: any) {
            logger.error('Failed to warm system config', { error: error.message });
        }
    },
};
