// gnani-rnd-backend/src/jobs/cleanup.job.ts

import cron from 'node-cron';
import { createContextualLogger } from '../core/logger/logger.js';

const logger = createContextualLogger({ module: 'CleanupJob' });

export class CleanupJob {
    private isRunning = false;

    start() {
        // Run daily at 2 AM
        cron.schedule('0 2 * * *', async () => {
            if (this.isRunning) {
                logger.warn('Cleanup job already running, skipping');
                return;
            }

            this.isRunning = true;
            logger.info('Starting cleanup job');

            try {
                // TODO: Implement ChromaDB cleanup when VectorManager exposes collection methods
                logger.info('Cleanup job completed');
            } catch (error: any) {
                logger.error('Cleanup job failed', error);
            } finally {
                this.isRunning = false;
            }
        });

        logger.info('Cleanup job scheduled (daily at 2 AM)');
    }

    // Manual trigger for testing
    async runNow() {
        logger.info('Manually triggering cleanup');

        try {
            // TODO: Implement ChromaDB cleanup
            logger.info('Manual cleanup completed');
        } catch (error: any) {
            logger.error('Manual cleanup failed', error);
            throw error;
        }
    }
}

export const cleanupJob = new CleanupJob();
