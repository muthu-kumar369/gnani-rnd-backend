// src/jobs/conversation-summarization.job.ts
import { createContextualLogger } from '../core/logger/logger.js';
import longTermMemory from '../modules/memory/services/long-term-memory.service.js';
import ConversationSummary from '../modules/memory/entities/conversation-summary.entity.js';
import { Logger } from 'winston';

class ConversationSummarizationJob {
    private logger: Logger;
    private isRunning: boolean = false;
    private BATCH_SIZE: number;

    constructor() {
        this.logger = createContextualLogger({ module: 'ConversationSummarizationJob' });
        this.BATCH_SIZE = parseInt(process.env.MEMORY_SUMMARIZATION_BATCH_SIZE || '10', 10);
        this.logger.info('ConversationSummarizationJob initialized.');
    }

    /**
     * Run the summarization job
     */
    async run(): Promise<void> {
        if (this.isRunning) {
            this.logger.warn('Summarization job already running, skipping this execution.');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();
        this.logger.info('Starting conversation summarization job...');

        try {
            // Get pending summaries that need embedding
            const pendingSummaries = await longTermMemory.getPendingSummaries(this.BATCH_SIZE);
            
            if (pendingSummaries.length === 0) {
                this.logger.info('No pending summaries to process');
                return;
            }

            this.logger.info(`Processing ${pendingSummaries.length} pending summaries`);

            let successCount = 0;
            let failureCount = 0;

            for (const summary of pendingSummaries) {
                try {
                    // Update status to processing
                    await ConversationSummary.findByIdAndUpdate(summary._id, {
                        embeddingStatus: 'processing'
                    });

                    // Store embedding in ChromaDB
                    const success = await longTermMemory.storeEmbedding(
                        summary._id.toString(),
                        summary.userId,
                        summary.summary,
                        {
                            topics: summary.topics,
                            messageCount: summary.messageCount,
                            startTime: summary.startTime,
                            endTime: summary.endTime
                        }
                    );

                    if (success) {
                        successCount++;
                        this.logger.debug(`Successfully processed summary ${summary._id}`);
                    } else {
                        failureCount++;
                    }
                } catch (error: any) {
                    this.logger.error(`Error processing summary ${summary._id}: ${error.message}`);
                    failureCount++;
                    
                    // Update status to failed
                    await ConversationSummary.findByIdAndUpdate(summary._id, {
                        embeddingStatus: 'failed'
                    });
                }
            }

            const duration = Date.now() - startTime;
            this.logger.info(
                `Summarization job completed in ${duration}ms. ` +
                `Success: ${successCount}, Failed: ${failureCount}`
            );
        } catch (error: any) {
            this.logger.error(`Error in summarization job: ${error.message}`);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Schedule the job to run every 6 hours
     */
    schedule(): void {
        const SIX_HOURS = 6 * 60 * 60 * 1000;
        
        setInterval(() => {
            this.run();
        }, SIX_HOURS);

        // Run immediately on startup
        setTimeout(() => {
            this.run();
        }, 5000); // Wait 5 seconds after startup

        this.logger.info('Summarization job scheduled to run every 6 hours');
    }
}

export default new ConversationSummarizationJob();
