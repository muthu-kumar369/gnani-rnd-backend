// src/modules/memory/memory.routes.ts
import { Router } from 'express';
import crossConversationMemory from './cross-conversation-memory.service.js';
import { createContextualLogger } from '../../core/logger/logger.js';
import { validate } from '../../middleware/zod.middleware.js';
import { z } from 'zod';

const router = Router();
const logger = createContextualLogger({ module: 'MemoryRoutes' });

// Validation schemas
const relatedConversationsSchema = z.object({
    body: z.object({
        conversationId: z.string().uuid('Invalid conversation ID'),
        userId: z.string().uuid('Invalid user ID'),
        limit: z.number().int().min(1).max(20).optional()
    })
});

/**
 * Find related conversations
 * POST /api/memory/related
 * Body: { conversationId: string, userId: string, limit?: number }
 */
router.post('/related', validate(relatedConversationsSchema), async (req, res) => {
    try {
        const { conversationId, userId, limit } = req.body;

        if (!conversationId || !userId) {
            return res.status(400).json({ success: false, error: 'conversationId and userId are required' });
        }

        const related = await crossConversationMemory.findRelatedConversations(conversationId, userId, limit || 5);

        res.json({
            success: true,
            count: related.length,
            data: related
        });
    } catch (error: any) {
        logger.error(`Finding related conversations failed: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to find related conversations' });
    }
});

export default router;
