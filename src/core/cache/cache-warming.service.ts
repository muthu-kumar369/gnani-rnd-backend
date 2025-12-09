import { createContextualLogger } from '../logger/logger.js';
import redisClient from '../../config/redis.config.js';

const logger = createContextualLogger({ module: 'CacheWarming' });

export interface WarmingStrategy {
    name: string;
    interval: number; // milliseconds
    execute: () => Promise<void>;
}

export class CacheWarmingService {
    private strategies: WarmingStrategy[] = [];
    private intervals: NodeJS.Timeout[] = [];

    /**
     * Register a cache warming strategy
     */
    registerStrategy(strategy: WarmingStrategy): void {
        this.strategies.push(strategy);
        logger.info('Registered cache warming strategy', {
            name: strategy.name,
            interval: strategy.interval,
        });
    }

    /**
     * Start all warming strategies
     */
    start(): void {
        for (const strategy of this.strategies) {
            // Execute immediately
            this.executeStrategy(strategy);

            // Schedule periodic execution
            const interval = setInterval(
                () => this.executeStrategy(strategy),
                strategy.interval
            );

            this.intervals.push(interval);
        }

        logger.info('Cache warming started', {
            strategyCount: this.strategies.length,
        });
    }

    /**
     * Stop all warming strategies
     */
    stop(): void {
        for (const interval of this.intervals) {
            clearInterval(interval);
        }
        this.intervals = [];
        logger.info('Cache warming stopped');
    }

    /**
     * Execute a warming strategy
     */
    private async executeStrategy(strategy: WarmingStrategy): Promise<void> {
        try {
            const startTime = Date.now();
            await strategy.execute();
            const duration = Date.now() - startTime;

            logger.debug('Cache warming strategy executed', {
                name: strategy.name,
                duration,
            });
        } catch (error: any) {
            logger.error('Cache warming strategy failed', {
                name: strategy.name,
                error: error.message,
            });
        }
    }
}

export default new CacheWarmingService();
