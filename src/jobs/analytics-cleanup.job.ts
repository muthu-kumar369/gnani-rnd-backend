// gnani-rnd-backend/src/jobs/analytics-cleanup.job.ts

import cron from 'node-cron';
import { createContextualLogger } from '../core/logger/logger.js';
import { Analytics } from '../models/analytics.model.js';

const logger = createContextualLogger({ module: 'AnalyticsCleanupJob' });

interface AggregatedData {
    date: Date;
    totalEvents: number;
    eventTypes: Record<string, number>;
    uniqueUsers: number;
}

export class AnalyticsCleanupJob {
    private retentionDays: number;
    private isRunning: boolean = false;

    constructor(retentionDays: number = 90) {
        this.retentionDays = retentionDays;
    }

    /**
     * Start the cleanup job (runs daily at 2 AM)
     */
    start(): void {
        logger.info('Starting analytics cleanup job', {
            schedule: '0 2 * * *',
            retentionDays: this.retentionDays
        });

        // Run daily at 2 AM
        cron.schedule('0 2 * * *', async () => {
            await this.run();
        });

        logger.info('Analytics cleanup job scheduled');
    }

    /**
     * Run the cleanup process
     */
    async run(): Promise<void> {
        if (this.isRunning) {
            logger.warn('Cleanup job already running, skipping');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();

        try {
            logger.info('Starting analytics cleanup');

            // Calculate cutoff date
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

            logger.info('Cleanup cutoff date', {
                cutoffDate: cutoffDate.toISOString(),
                retentionDays: this.retentionDays
            });

            // Aggregate old data before deletion
            const aggregated = await this.aggregateOldData(cutoffDate);
            logger.info('Aggregated old data', {
                recordsAggregated: aggregated.length
            });

            // Delete old events
            const result = await Analytics.deleteMany({
                timestamp: { $lt: cutoffDate }
            });

            const duration = Date.now() - startTime;

            logger.info('Analytics cleanup completed', {
                deletedCount: result.deletedCount,
                aggregatedRecords: aggregated.length,
                durationMs: duration
            });
        } catch (error: any) {
            logger.error('Analytics cleanup failed', {
                error: error.message,
                stack: error.stack
            });
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Aggregate old data by day before deletion
     */
    private async aggregateOldData(cutoffDate: Date): Promise<AggregatedData[]> {
        try {
            // Aggregate by day
            const aggregated = await Analytics.aggregate([
                {
                    $match: {
                        timestamp: { $lt: cutoffDate }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$timestamp'
                            }
                        },
                        totalEvents: { $sum: 1 },
                        eventTypes: {
                            $push: '$eventType'
                        },
                        uniqueUsers: {
                            $addToSet: '$userId'
                        }
                    }
                },
                {
                    $project: {
                        date: '$_id',
                        totalEvents: 1,
                        eventTypes: 1,
                        uniqueUsers: { $size: '$uniqueUsers' }
                    }
                },
                {
                    $sort: { date: 1 }
                }
            ]);

            // Process event types into counts
            const processed = aggregated.map((record: any) => {
                const eventTypeCounts: Record<string, number> = {};
                record.eventTypes.forEach((type: string) => {
                    eventTypeCounts[type] = (eventTypeCounts[type] || 0) + 1;
                });

                return {
                    date: new Date(record.date),
                    totalEvents: record.totalEvents,
                    eventTypes: eventTypeCounts,
                    uniqueUsers: record.uniqueUsers
                };
            });

            // Store aggregated data (could save to separate collection)
            logger.debug('Aggregated data summary', {
                totalDays: processed.length,
                totalEvents: processed.reduce((sum: number, r: AggregatedData) => sum + r.totalEvents, 0)
            });

            // TODO: Save aggregated data to AnalyticsAggregated collection
            // await AnalyticsAggregated.insertMany(processed);

            return processed;
        } catch (error: any) {
            logger.error('Failed to aggregate old data', {
                error: error.message
            });
            return [];
        }
    }

    /**
     * Manual trigger for testing
     */
    async runManual(): Promise<void> {
        logger.info('Manual cleanup triggered');
        await this.run();
    }

    /**
     * Update retention period
     */
    setRetentionDays(days: number): void {
        this.retentionDays = days;
        logger.info('Retention period updated', { retentionDays: days });
    }
}

// Export singleton
export const analyticsCleanupJob = new AnalyticsCleanupJob();

// Auto-start if not in test environment
if (process.env.NODE_ENV !== 'test') {
    analyticsCleanupJob.start();
}

export default analyticsCleanupJob;
