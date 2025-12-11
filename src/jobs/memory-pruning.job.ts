// gnani-rnd-backend/src/jobs/memory-pruning.job.ts

import cron from 'node-cron';
import { createContextualLogger } from '../core/logger/logger.js';
import memoryScorer from '../modules/memory/services/memory-scorer.service.js';
// import User from '../models/user.model.js'; // TODO: Create User model

const logger = createContextualLogger({ module: 'MemoryPruningJob' });

export class MemoryPruningJob {
    private maxMemoriesPerUser: number;
    private isRunning: boolean = false;

    constructor(maxMemoriesPerUser: number = 1000) {
        this.maxMemoriesPerUser = maxMemoriesPerUser;
    }

    /**
     * Start the memory pruning job (runs daily at 3 AM)
     */
    start(): void {
        logger.info('Starting memory pruning job', {
            schedule: '0 3 * * *',
            maxMemoriesPerUser: this.maxMemoriesPerUser
        });

        // Run daily at 3 AM
        cron.schedule('0 3 * * *', async () => {
            await this.run();
        });

        logger.info('Memory pruning job scheduled');
    }

    /**
     * Run the pruning process for all users
     */
    async run(): Promise<void> {
        if (this.isRunning) {
            logger.warn('Pruning job already running, skipping');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();

        try {
            logger.info('Starting memory pruning for all users');

            // Get all users
            // const users = await User.find({}).select('_id').lean();
            const users: any[] = []; // TODO: Fetch from User model

            let totalPruned = 0;
            let usersProcessed = 0;

            // Prune memories for each user
            for (const user of users) {
                try {
                    const pruned = await memoryScorer.pruneMemories(
                        user._id.toString(),
                        this.maxMemoriesPerUser
                    );
                    totalPruned += pruned;
                    usersProcessed++;
                } catch (error: any) {
                    logger.error('Failed to prune memories for user', {
                        userId: user._id,
                        error: error.message
                    });
                }
            }

            const duration = Date.now() - startTime;

            logger.info('Memory pruning completed', {
                usersProcessed,
                totalMemoriesPruned: totalPruned,
                durationMs: duration
            });
        } catch (error: any) {
            logger.error('Memory pruning job failed', {
                error: error.message,
                stack: error.stack
            });
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Manual trigger for testing
     */
    async runManual(): Promise<void> {
        logger.info('Manual memory pruning triggered');
        await this.run();
    }

    /**
     * Update max memories per user
     */
    setMaxMemories(max: number): void {
        this.maxMemoriesPerUser = max;
        logger.info('Max memories per user updated', { maxMemories: max });
    }
}

// Export singleton
export const memoryPruningJob = new MemoryPruningJob();

// Auto-start if not in test environment
if (process.env.NODE_ENV !== 'test') {
    memoryPruningJob.start();
}

export default memoryPruningJob;
