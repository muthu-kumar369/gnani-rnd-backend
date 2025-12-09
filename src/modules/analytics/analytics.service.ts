// src/modules/analytics/analytics.service.ts
import { createContextualLogger } from '../../core/logger/logger.js';
import Session from '../session/session.model.js';
import Conversation from '../conversation/conversation.model.js';
import { TokenUsage } from '../llm/token-counter.service.js';
import redis from '../../config/redis.config.js';

const logger = createContextualLogger({ module: 'AnalyticsService' });

export interface DashboardStats {
    totalConversations: number;
    activeSessions: number;
    totalMessages: number;
    totalTokens: number;
    avgSystemLatency: number;
    modelUsage: Record<string, number>;
}

class AnalyticsService {

    /**
     * Get aggregated dashboard statistics
     */
    async getDashboardStats(): Promise<DashboardStats> {
        try {
            const totalConversations = await Conversation.countDocuments();
            const activeSessions = await Session.countDocuments({ state: { $ne: 'ENDED' } }); // Approximate

            // Aggregating messages (assuming messages are in conversations)
            // This is an expensive operation for a large DB, but fine for single-LLM foundation
            const msgAggregation = await Conversation.aggregate([
                { $project: { msgCount: { $size: "$messages" } } },
                { $group: { _id: null, total: { $sum: "$msgCount" } } }
            ]);
            const totalMessages = msgAggregation.length > 0 ? msgAggregation[0].total : 0;

            // Mock token usage if not tracked globally in DB yet. 
            // Ideally we'd aggregate from a TokenUsage collection.
            // For now, returning 0 or getting from a simple redis counter if available, 
            // or just placeholder as this is a "Foundation" level.
            // We'll use a placeholder implementation that can be expanded.
            const totalTokens = 0;

            // Mock Latency
            const avgSystemLatency = 0;

            // Mock Model Usage
            const modelUsage = {};

            return {
                totalConversations,
                activeSessions,
                totalMessages,
                totalTokens,
                avgSystemLatency,
                modelUsage
            };
        } catch (error: any) {
            logger.error(`Failed to get dashboard stats: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get daily activity series (last 7 days)
     */
    async getDailyActivity(): Promise<any[]> {
        // Placeholder for chart data
        // Would aggregate conversations by createdAt
        const curDate = new Date();
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(curDate);
            d.setDate(d.getDate() - i);
            last7Days.push({
                date: d.toISOString().split('T')[0],
                conversations: 0, // Implement aggregation
                messages: 0
            });
        }
        return last7Days;
    }
}

export default new AnalyticsService();
