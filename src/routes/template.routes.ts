import { Router, Request, Response } from 'express';
import Conversation from '../modules/conversation/conversation.model.js';
import { authMiddleware, type CustomRequest } from '../core/security/auth.middleware.js';
import { createContextualLogger } from '../core/logger/logger.js';

const router = Router();
const logger = createContextualLogger({ module: 'TemplateRoutes' });

// PATCH /api/conversations/:conversationId/template - Apply template to conversation
router.patch('/:conversationId/template', authMiddleware, async (req: CustomRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { conversationId } = req.params;
        const { templateId, systemPrompt } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!templateId || !systemPrompt) {
            return res.status(400).json({ error: 'Template ID and system prompt are required' });
        }

        // Update conversation template and system prompt
        const conversation = await Conversation.findOneAndUpdate(
            { _id: conversationId, userId },
            {
                $set: {
                    currentTemplate: templateId,
                    systemPrompt: systemPrompt,
                }
            },
            { new: true }
        );

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        logger.info(`Template ${templateId} applied to conversation ${conversationId}`);

        res.json({
            success: true,
            templateId,
            conversationId,
        });
    } catch (error) {
        logger.error('Failed to apply template', error as Error);
        res.status(500).json({ error: 'Failed to apply template' });
    }
});

export default router;
