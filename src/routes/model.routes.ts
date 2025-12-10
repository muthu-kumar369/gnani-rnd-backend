import { Router, Request, Response } from 'express';
import Conversation from '../modules/conversation/conversation.model.js';
import { authMiddleware, type CustomRequest } from '../core/security/auth.middleware.js';
import { createContextualLogger } from '../core/logger/logger.js';

const router = Router();
const logger = createContextualLogger({ module: 'ModelRoutes' });

// PATCH /api/conversations/:conversationId/model - Switch model for conversation
router.patch('/:conversationId/model', authMiddleware, async (req: CustomRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { conversationId } = req.params;
        const { model } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!model) {
            return res.status(400).json({ error: 'Model is required' });
        }

        // Update conversation model
        const conversation = await Conversation.findOneAndUpdate(
            { _id: conversationId, userId },
            { $set: { model } },
            { new: true }
        );

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        logger.info(`Model switched to ${model} for conversation ${conversationId}`);

        res.json({
            success: true,
            model,
            conversationId,
        });
    } catch (error) {
        logger.error('Failed to switch model', error as Error);
        res.status(500).json({ error: 'Failed to switch model' });
    }
});

export default router;
