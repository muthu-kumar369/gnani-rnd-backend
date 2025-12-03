// gnani-rnd-backend/src/jobs/mongodb-cleanup.job.ts

import cron from 'node-cron';
import Conversation from '../modules/conversation/conversation.model.js';
import { createContextualLogger } from '../core/logger/logger.js';

const logger = createContextualLogger({ module: 'MongoDBCleanupJob' });

export class MongoDBCleanupJob {
    private isRunning = false;

    start() {
        // Run weekly on Sunday at 3 AM
        cron.schedule('0 3 * * 0', async () => {
            if (this.isRunning) {
                logger.warn('MongoDB cleanup job already running, skipping');
                return;
            }

            this.isRunning = true;
            logger.info('Starting MongoDB cleanup job');

            try {
                // Delete conversations older than 90 days
                const ninetyDaysAgo = new Date(Date.now() - (90 * 24 * 60 * 60 * 1000));

                const result = await Conversation.deleteMany({
                    createdAt: { $lt: ninetyDaysAgo },
                    archived: true
                });

                logger.info('MongoDB cleanup job completed', { deleted: result.deletedCount });
            } catch (error: any) {
                logger.error('MongoDB cleanup job failed', error);
            } finally {
                this.isRunning = false;
            }
        });

        logger.info('MongoDB cleanup job scheduled (weekly on Sunday at 3 AM)');
    }

    // Manual trigger for testing
    async runNow() {
        logger.info('Manually triggering MongoDB cleanup');
        const ninetyDaysAgo = new Date(Date.now() - (90 * 24 * 60 * 60 * 1000));

        try {
            const result = await Conversation.deleteMany({
                createdAt: { $lt: ninetyDaysAgo },
                archived: true
            });
            logger.info('Manual MongoDB cleanup completed', { deleted: result.deletedCount });
            return result.deletedCount;
        } catch (error: any) {
            logger.error('Manual MongoDB cleanup failed', error);
            throw error;
        }
    }
}

export const mongoDBCleanupJob = new MongoDBCleanupJob();
