import { Router, Request, Response } from 'express';
import ConversationMessage from '../modules/memory/entities/conversation.entity.js';
import { createContextualLogger } from '../core/logger/logger.js';
import { Types } from 'mongoose';

const router = Router();
const logger = createContextualLogger({ module: 'AnalyticsRoutes' });

// GET /api/analytics/stats - Get user analytics summary
router.get('/stats', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Aggregate from ConversationMessage
        const stats = await ConversationMessage.aggregate([
            { $match: { userId, 'tokenUsage': { $exists: true } } },
            {
                $group: {
                    _id: null,
                    totalTokens: { $sum: '$tokenUsage.totalTokens' },
                    totalCost: { $sum: '$tokenUsage.estimatedCost' },
                    messageCount: { $sum: 1 }
                }
            }
        ]);

        const result = stats[0] || { totalTokens: 0, totalCost: 0, messageCount: 0 };

        res.json({
            ...result,
            totalCost: Number(result.totalCost.toFixed(4))
        });
    } catch (error) {
        logger.error('Failed to fetch analytics stats', error as Error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// GET /api/analytics/usage - Get usage over time
router.get('/usage', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const days = parseInt(req.query.days as string) || 30; // Default 30 days

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const usage = await ConversationMessage.aggregate([
            {
                $match: {
                    userId,
                    timestamp: { $gte: startDate },
                    'tokenUsage': { $exists: true }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                    tokens: { $sum: '$tokenUsage.totalTokens' },
                    cost: { $sum: '$tokenUsage.estimatedCost' },
                    messages: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } },
            {
                $project: {
                    date: '$_id',
                    tokens: 1,
                    cost: { $round: ['$cost', 4] },
                    messages: 1,
                    _id: 0
                }
            }
        ]);

        res.json(usage);
    } catch (error) {
        logger.error('Failed to fetch usage data', error as Error);
        res.status(500).json({ error: 'Failed to fetch usage data' });
    }
});

// GET /api/analytics/export - Export data (CSV/JSON)
router.get('/export', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const format = (req.query.format as string) || 'csv';

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const data = await ConversationMessage.aggregate([
            { $match: { userId, 'tokenUsage': { $exists: true } } },
            { $sort: { timestamp: -1 } },
            {
                $project: {
                    conversationId: 1,
                    role: 1,
                    content: 1, // Be careful with content size
                    timestamp: 1,
                    model: '$tokenUsage.model',
                    tokens: '$tokenUsage.totalTokens',
                    cost: '$tokenUsage.estimatedCost'
                }
            }
        ]);

        if (format === 'json') {
            res.json(data);
        } else {
            // CSV
            const header = 'Date,Conversation ID,Role,Model,Tokens,Cost,Content\n';
            const rows = data.map(row => {
                const date = new Date(row.timestamp).toISOString();
                const content = `"${row.content.replace(/"/g, '""').substring(0, 1000)}"`; // Truncate content for CSV safety
                return `${date},${row.conversationId},${row.role},${row.model},${row.tokens},${row.cost},${content}`;
            }).join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=usage_export.csv');
            res.send(header + rows);
        }
    } catch (error) {
        logger.error('Failed to export data', error as Error);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

export default router;
