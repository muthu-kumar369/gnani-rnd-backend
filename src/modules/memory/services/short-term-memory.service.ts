// src/modules/memory/services/short-term-memory.service.ts
import { createContextualLogger } from '../../../core/logger/logger.js';
import ConversationMessage, { IConversationMessage } from '../entities/conversation.entity.js';
import { Logger } from 'winston';

class ShortTermMemoryService {
    private logger: Logger;
    private RETENTION_DAYS: number;

    constructor() {
        this.logger = createContextualLogger({ module: 'ShortTermMemoryService' });
        this.RETENTION_DAYS = parseInt(process.env.MEMORY_SHORT_TERM_RETENTION_DAYS || '30', 10);
        this.logger.info(`ShortTermMemoryService initialized with ${this.RETENTION_DAYS} days retention.`);
    }

    /**
     * Store a new message in short-term memory
     */
    async storeMessage(
        userId: string,
        sessionId: string,
        role: 'user' | 'assistant',
        content: string,
        metadata: any = {}
    ): Promise<IConversationMessage> {
        try {
            const message = new ConversationMessage({
                userId,
                sessionId,
                role,
                content,
                metadata,
                timestamp: new Date()
            });

            await message.save();
            this.logger.debug(`Stored ${role} message for session ${sessionId}`);

            // Trigger title generation after 3rd message (fire-and-forget)
            // Count messages asynchronously to avoid blocking
            ConversationMessage.countDocuments({ sessionId })
                .then(async (count) => {
                    if (count === 3) {
                        this.logger.info(`Triggering title generation for session ${sessionId} (3 messages)`);
                        // Import conversation service dynamically to avoid circular dependency
                        const conversationService = (await import('../../conversation/conversation.service.js')).default;
                        conversationService.generateConversationTitle(sessionId, userId)
                            .catch((err: any) => {
                                this.logger.error(`Failed to generate title for session ${sessionId}: ${err.message}`);
                            });
                    }
                })
                .catch((err: any) => {
                    this.logger.warn(`Failed to count messages for title generation: ${err.message}`);
                });

            return message;
        } catch (error: any) {
            this.logger.error(`Error storing message: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get recent messages for a user (chronological order)
     */
    async getRecentMessages(
        userId: string,
        limit: number = 20,
        maxAgeDays?: number
    ): Promise<IConversationMessage[]> {
        try {
            const query: any = { userId };

            if (maxAgeDays) {
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
                query.timestamp = { $gte: cutoffDate };
            }

            const messages = await ConversationMessage
                .find(query)
                .sort({ timestamp: -1 })
                .limit(limit)
                .lean()
                .exec();

            // Reverse to get chronological order (oldest first)
            return messages.reverse() as unknown as IConversationMessage[];
        } catch (error: any) {
            this.logger.error(`Error retrieving recent messages: ${error.message}`);
            return [];
        }
    }

    /**
     * Get all messages for a specific session
     */
    async getSessionMessages(sessionId: string): Promise<IConversationMessage[]> {
        try {
            const messages = await ConversationMessage
                .find({ sessionId })
                .sort({ timestamp: 1 })
                .lean()
                .exec();

            return messages as unknown as IConversationMessage[];
        } catch (error: any) {
            this.logger.error(`Error retrieving session messages: ${error.message}`);
            return [];
        }
    }

    /**
     * Get messages ready for summarization (older than retention period)
     */
    async getMessagesForSummarization(
        userId: string,
        batchSize: number = 100
    ): Promise<IConversationMessage[]> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);

            const messages = await ConversationMessage
                .find({
                    userId,
                    timestamp: { $lt: cutoffDate }
                })
                .sort({ timestamp: 1 })
                .limit(batchSize)
                .lean()
                .exec();

            return messages as unknown as IConversationMessage[];
        } catch (error: any) {
            this.logger.error(`Error retrieving messages for summarization: ${error.message}`);
            return [];
        }
    }

    /**
     * Delete old messages (manual cleanup, TTL index handles auto-deletion)
     */
    async cleanupOldMessages(): Promise<number> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);

            const result = await ConversationMessage.deleteMany({
                createdAt: { $lt: cutoffDate }
            });

            this.logger.info(`Cleaned up ${result.deletedCount} old messages`);
            return result.deletedCount || 0;
        } catch (error: any) {
            this.logger.error(`Error cleaning up old messages: ${error.message}`);
            return 0;
        }
    }

    /**
     * Delete messages for a specific session
     */
    async deleteSessionMessages(sessionId: string): Promise<number> {
        try {
            const result = await ConversationMessage.deleteMany({ sessionId });
            this.logger.debug(`Deleted ${result.deletedCount} messages for session ${sessionId}`);
            return result.deletedCount || 0;
        } catch (error: any) {
            this.logger.error(`Error deleting session messages: ${error.message}`);
            return 0;
        }
    }

    /**
     * Get conversation statistics for a user
     */
    async getUserStats(userId: string): Promise<{
        totalMessages: number;
        userMessages: number;
        assistantMessages: number;
        oldestMessage?: Date;
        newestMessage?: Date;
    }> {
        try {
            const [stats] = await ConversationMessage.aggregate([
                { $match: { userId } },
                {
                    $group: {
                        _id: null,
                        totalMessages: { $sum: 1 },
                        userMessages: {
                            $sum: { $cond: [{ $eq: ['$role', 'user'] }, 1, 0] }
                        },
                        assistantMessages: {
                            $sum: { $cond: [{ $eq: ['$role', 'assistant'] }, 1, 0] }
                        },
                        oldestMessage: { $min: '$timestamp' },
                        newestMessage: { $max: '$timestamp' }
                    }
                }
            ]);

            return stats || {
                totalMessages: 0,
                userMessages: 0,
                assistantMessages: 0
            };
        } catch (error: any) {
            this.logger.error(`Error getting user stats: ${error.message}`);
            return {
                totalMessages: 0,
                userMessages: 0,
                assistantMessages: 0
            };
        }
    }
}

export default new ShortTermMemoryService();
