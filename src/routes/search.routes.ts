import { Router, Request, Response } from 'express';
import Conversation from '../modules/conversation/conversation.model.js';
import { authMiddleware, type CustomRequest } from '../core/security/auth.middleware.js';
import { createContextualLogger } from '../core/logger/logger.js';

const router = Router();
const logger = createContextualLogger({ module: 'SearchRoutes' });

// POST /api/search - Advanced search with filters
router.post('/', authMiddleware, async (req: CustomRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { query, filters = {} } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!query || !query.trim()) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        // Build search query
        const searchQuery: any = {
            userId,
            isDeleted: false,
            $text: { $search: query.trim() },
        };

        // Apply filters
        if (filters.dateFrom) {
            searchQuery.createdAt = { $gte: new Date(filters.dateFrom) };
        }

        if (filters.dateTo) {
            searchQuery.createdAt = {
                ...searchQuery.createdAt,
                $lte: new Date(filters.dateTo),
            };
        }

        if (filters.model) {
            searchQuery.currentModel = filters.model;
        }

        // Search conversations
        const conversations = await Conversation.find(searchQuery, {
            score: { $meta: 'textScore' },
        })
            .sort({ score: { $meta: 'textScore' }, updatedAt: -1 })
            .limit(20)
            .lean();

        // Format results
        const results = conversations.map((conv: any) => {
            // Get snippet from system prompt or title
            const snippet = conv.systemPrompt?.substring(0, 150) + '...' || conv.title?.substring(0, 150) + '...' || 'No preview available';

            return {
                conversationId: conv._id,
                title: conv.title || 'Untitled Conversation',
                snippet,
                score: conv.score || 0,
                createdAt: conv.createdAt,
                model: conv.currentModel,
            };
        });

        logger.info(`Search completed: "${query}" - ${results.length} results`);

        res.json({ results });
    } catch (error) {
        logger.error('Search failed', error as Error);
        res.status(500).json({ error: 'Search failed' });
    }
});

export default router;
