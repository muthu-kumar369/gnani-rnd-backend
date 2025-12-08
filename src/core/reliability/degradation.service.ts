// src/core/reliability/degradation.service.ts
import { createContextualLogger } from '../logger/logger.js';

const logger = createContextualLogger({ module: 'Degradation' });

export class DegradationService {
    /**
     * Execute with fallback
     */
    async executeWithFallback<T>(
        primary: () => Promise<T>,
        fallback: () => Promise<T> | T,
        operationName: string
    ): Promise<T> {
        try {
            return await primary();
        } catch (error: any) {
            logger.warn(`${operationName} failed, using fallback: ${error.message}`);
            return await fallback();
        }
    }

    /**
     * Execute with multiple fallbacks
     */
    async executeWithFallbacks<T>(
        strategies: Array<() => Promise<T>>,
        operationName: string
    ): Promise<T> {
        let lastError: Error;

        for (let i = 0; i < strategies.length; i++) {
            try {
                logger.debug(`${operationName}: Trying strategy ${i + 1}/${strategies.length}`);
                return await strategies[i]();
            } catch (error: any) {
                lastError = error;
                logger.warn(`${operationName}: Strategy ${i + 1} failed: ${error.message}`);
            }
        }

        logger.error(`${operationName}: All strategies failed`);
        throw lastError!;
    }
}

export default new DegradationService();
