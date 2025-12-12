import { Router, Request, Response } from 'express';
import SharedConversation from '../models/shared-conversation.model.js';
import Conversation from '../modules/conversation/conversation.model.js';
import { authMiddleware, type CustomRequest } from '../core/security/auth.middleware.js';
import { createContextualLogger } from '../core/logger/logger.js';
import { nanoid } from 'nanoid';

const router = Router();
const logger = createContextualLogger({ module: 'ShareRoutes' });

// POST /api/share - Create shareable link
router.post('/', authMiddleware, async (req: CustomRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { conversationId, expiresIn } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!conversationId) {
            return res.status(400).json({ error: 'Conversation ID required' });
        }

        // Verify conversation belongs to user
        const conversation = await Conversation.findOne({ conversationId, userId });
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Generate unique share ID
        const shareId = nanoid(10);

        // Calculate expiration
        let expiresAt: Date | undefined;
        if (expiresIn) {
            expiresAt = new Date(Date.now() + expiresIn * 1000);
        }

        // Create or update share
        const share = await SharedConversation.findOneAndUpdate(
            { conversationId, userId },
            {
                conversationId,
                userId,
                shareId,
                isPublic: true,
                expiresAt,
                viewCount: 0,
            },
            { upsert: true, new: true }
        );

        logger.info(`Conversation ${conversationId} shared with ID ${shareId}`);

        res.json({
            shareId,
            shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/share/${shareId}`,
            expiresAt,
        });
    } catch (error) {
        logger.error('Failed to create share', error as Error);
        res.status(500).json({ error: 'Failed to create share' });
    }
});

// GET /api/share/:shareId - Get shared conversation
router.get('/:shareId', async (req: Request, res: Response) => {
    try {
        const { shareId } = req.params;

        const share = await SharedConversation.findOne({ shareId });
        if (!share) {
            return res.status(404).json({ error: 'Share not found' });
        }

        // Check expiration
        if (share.expiresAt && share.expiresAt < new Date()) {
            return res.status(410).json({ error: 'Share has expired' });
        }

        // Get conversation
        const conversation = await Conversation.findOne({ conversationId: share.conversationId }).lean() as any;
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Increment view count
        await SharedConversation.updateOne({ shareId }, { $inc: { viewCount: 1 } });

        res.json({
            conversation: {
                id: conversation._id,
                title: conversation.title,
                messages: conversation.messages || [],
                createdAt: conversation.createdAt,
            },
            viewCount: share.viewCount + 1,
        });
    } catch (error) {
        logger.error('Failed to get shared conversation', error as Error);
        res.status(500).json({ error: 'Failed to get conversation' });
    }
});

// DELETE /api/share/:conversationId - Revoke share
router.delete('/:conversationId', authMiddleware, async (req: CustomRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { conversationId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        await SharedConversation.deleteOne({ conversationId, userId });

        logger.info(`Share revoked for conversation ${conversationId}`);

        res.json({ success: true });
    } catch (error) {
        logger.error('Failed to revoke share', error as Error);
        res.status(500).json({ error: 'Failed to revoke share' });
    }
});

export default router;
