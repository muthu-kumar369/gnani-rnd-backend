import { Router, Request, Response } from 'express';
import { Analytics } from '../models/analytics.model.js';
import { createContextualLogger } from '../core/logger/logger.js';

const router = Router();
const logger = createContextualLogger({ module: 'AnalyticsRoutes' });

// GET /api/analytics/stats - Get user analytics summary
router.get('/stats', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId; // From auth middleware

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Aggregate analytics data
        const [tokenStats, eventCounts, conversationCount] = await Promise.all([
            // Total tokens and cost
            Analytics.aggregate([
                { $match: { userId, event: 'tokens_used' } },
                {
                    $group: {
                        _id: null,
                        totalTokens: { $sum: '$metadata.tokens' },
                        totalCost: { $sum: '$metadata.cost' },
                    },
                },
            ]),

            // Event counts
            Analytics.aggregate([
                { $match: { userId } },
                {
                    $group: {
                        _id: '$event',
                        count: { $sum: 1 },
                    },
                },
            ]),

            // Unique conversations
            Analytics.distinct('conversationId', { userId, conversationId: { $exists: true } }),
        ]);

        const stats = {
            totalTokens: tokenStats[0]?.totalTokens || 0,
            totalCost: tokenStats[0]?.totalCost || 0,
            conversationCount: conversationCount.length,
            messageCount: eventCounts.find((e) => e._id === 'message_sent')?.count || 0,
            events: eventCounts,
        };

        res.json(stats);
    } catch (error) {
        logger.error('Failed to fetch analytics stats', error as Error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// GET /api/analytics/usage - Get usage over time
router.get('/usage', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        const days = parseInt(req.query.days as string) || 7;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const usage = await Analytics.aggregate([
            {
                $match: {
                    userId,
                    event: 'tokens_used',
                    timestamp: { $gte: startDate },
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$timestamp' },
                    },
                    tokens: { $sum: '$metadata.tokens' },
                    cost: { $sum: '$metadata.cost' },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        res.json(usage);
    } catch (error) {
        logger.error('Failed to fetch usage data', error as Error);
        res.status(500).json({ error: 'Failed to fetch usage data' });
    }
});

export default router;
