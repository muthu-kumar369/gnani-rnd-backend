import { Router, Request, Response } from 'express';
import { Feedback } from '../models/feedback.model.js';
import { authMiddleware, type CustomRequest } from '../core/security/auth.middleware.js';
import { createContextualLogger } from '../core/logger/logger.js';

const router = Router();
const logger = createContextualLogger({ module: 'FeedbackRoutes' });

// POST /api/feedback - Submit feedback
router.post('/', authMiddleware, async (req: CustomRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { conversationId, messageId, rating, comment, category } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!conversationId || !messageId || !rating) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (!['positive', 'negative'].includes(rating)) {
            return res.status(400).json({ error: 'Invalid rating' });
        }

        // Upsert feedback (update if exists, create if not)
        const feedback = await Feedback.findOneAndUpdate(
            { userId, messageId },
            {
                userId,
                conversationId,
                messageId,
                rating,
                comment,
                category,
                timestamp: new Date(),
            },
            { upsert: true, new: true }
        );

        logger.info(`Feedback submitted: ${rating} for message ${messageId} by user ${userId}`);

        res.json({ success: true, feedback });
    } catch (error) {
        logger.error('Failed to submit feedback', error as Error);
        res.status(500).json({ error: 'Failed to submit feedback' });
    }
});

// GET /api/feedback/stats - Get feedback statistics
router.get('/stats', authMiddleware, async (req: CustomRequest, res: Response) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const stats = await Feedback.aggregate([
            { $match: { userId } },
            {
                $group: {
                    _id: '$rating',
                    count: { $sum: 1 },
                },
            },
        ]);

        const result = {
            positive: stats.find((s) => s._id === 'positive')?.count || 0,
            negative: stats.find((s) => s._id === 'negative')?.count || 0,
        };

        res.json(result);
    } catch (error) {
        logger.error('Failed to fetch feedback stats', error as Error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

export default router;
