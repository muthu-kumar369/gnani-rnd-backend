// src/jobs/memory-cleanup.job.ts
import { createContextualLogger } from '../core/logger/logger.js';
import shortTermMemory from '../modules/memory/services/short-term-memory.service.js';
import sessionMemory from '../modules/memory/services/session-memory.service.js';
import { Logger } from 'winston';

class MemoryCleanupJob {
    private logger: Logger;
    private isRunning: boolean = false;

    constructor() {
        this.logger = createContextualLogger({ module: 'MemoryCleanupJob' });
        this.logger.info('MemoryCleanupJob initialized.');
    }

    /**
     * Run the cleanup job
     */
    async run(): Promise<void> {
        if (this.isRunning) {
            this.logger.warn('Cleanup job already running, skipping this execution.');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();
        this.logger.info('Starting memory cleanup job...');

        try {
            // 1. Clean up old short-term messages (TTL index handles this, but manual cleanup as backup)
            const deletedMessages = await shortTermMemory.cleanupOldMessages();
            this.logger.info(`Deleted ${deletedMessages} old messages from MongoDB`);

            // 2. Clean up expired Redis sessions
            const cleanedSessions = await sessionMemory.cleanupExpiredSessions();
            this.logger.info(`Cleaned up ${cleanedSessions} expired Redis sessions`);

            const duration = Date.now() - startTime;
            this.logger.info(`Memory cleanup job completed in ${duration}ms`);
        } catch (error: any) {
            this.logger.error(`Error in memory cleanup job: ${error.message}`);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Schedule the job to run daily
     */
    schedule(): void {
        // Run daily at 2 AM
        const runDaily = () => {
            const now = new Date();
            const next2AM = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate() + 1,
                2, 0, 0, 0
            );
            const timeUntil2AM = next2AM.getTime() - now.getTime();

            setTimeout(() => {
                this.run();
                runDaily(); // Schedule next run
            }, timeUntil2AM);
        };

        runDaily();
        this.logger.info('Memory cleanup job scheduled to run daily at 2 AM');
    }
}

export default new MemoryCleanupJob();
