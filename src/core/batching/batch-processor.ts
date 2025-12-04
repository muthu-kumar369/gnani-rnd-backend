// src/core/batching/batch-processor.ts
import { createContextualLogger } from '../logger/logger.js';

export class BatchProcessor<T, R> {
    private batches: Map<string, T[]> = new Map();
    private timers: Map<string, NodeJS.Timeout> = new Map();
    private resolvers: Map<string, Array<(value: R) => void>> = new Map();
    private rejectors: Map<string, Array<(reason?: any) => void>> = new Map();
    private logger = createContextualLogger({ module: 'BatchProcessor' });

    constructor(
        private processor: (items: T[]) => Promise<R[]>,
        private batchSize: number = 10,
        private batchTimeout: number = 100
    ) { }

    async addToBatch(key: string, item: T): Promise<R> {
        if (!this.batches.has(key)) {
            this.batches.set(key, []);
            this.resolvers.set(key, []);
            this.rejectors.set(key, []);
        }

        const batch = this.batches.get(key)!;
        const resolvers = this.resolvers.get(key)!;
        const rejectors = this.rejectors.get(key)!;

        batch.push(item);

        return new Promise<R>((resolve, reject) => {
            resolvers.push(resolve);
            rejectors.push(reject);

            if (batch.length >= this.batchSize) {
                this.processBatch(key);
            } else if (!this.timers.has(key)) {
                const timer = setTimeout(() => {
                    this.processBatch(key);
                }, this.batchTimeout);
                this.timers.set(key, timer);
            }
        });
    }

    private async processBatch(key: string) {
        const batch = this.batches.get(key) || [];
        const resolvers = this.resolvers.get(key) || [];
        const rejectors = this.rejectors.get(key) || [];

        // Clear state for this key immediately
        this.batches.delete(key);
        this.resolvers.delete(key);
        this.rejectors.delete(key);

        const timer = this.timers.get(key);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(key);
        }

        if (batch.length === 0) return;

        try {
            this.logger.debug(`Processing batch of size ${batch.length} for key ${key}`);
            const results = await this.processor(batch);

            if (results.length !== batch.length) {
                this.logger.warn(`Batch processor returned ${results.length} results for ${batch.length} items`);
            }

            batch.forEach((_, index) => {
                if (index < results.length) {
                    resolvers[index](results[index]);
                } else {
                    rejectors[index](new Error('Batch processor did not return a result for this item'));
                }
            });
        } catch (error: any) {
            this.logger.error(`Batch processing failed for key ${key}: ${error.message}`);
            rejectors.forEach(reject => reject(error));
        }
    }
}
