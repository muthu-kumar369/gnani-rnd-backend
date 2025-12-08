// src/jobs/session-cleanup.job.ts
import cron from 'node-cron';
import sessionPersistence from '../modules/session/session.persistence.js';
import { createContextualLogger } from '../core/logger/logger.js';

const logger = createContextualLogger({ module: 'SessionCleanupJob' });

// Run every hour
export const sessionCleanupJob = cron.schedule('0 * * * *', async () => {
    logger.info('Running session cleanup job...');

    try {
        const deletedCount = await sessionPersistence.cleanupExpiredSessions();
        logger.info(`Session cleanup completed. Deleted ${deletedCount} sessions.`);
    } catch (error: any) {
        logger.error(`Session cleanup failed: ${error.message}`);
    }
});

export function startSessionCleanupJob() {
    sessionCleanupJob.start();
    logger.info('Session cleanup job started (runs every hour)');
}

export function stopSessionCleanupJob() {
    sessionCleanupJob.stop();
    logger.info('Session cleanup job stopped');
}
