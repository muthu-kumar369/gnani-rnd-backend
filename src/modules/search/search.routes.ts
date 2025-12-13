// src/modules/search/search.routes.ts
import { Router } from 'express';
import hybridSearchService from './hybrid-search.service.js';
import Conversation from '../conversation/conversation.model.js';
import { authMiddleware, type CustomRequest } from '../../core/security/auth.middleware.js';
import { createContextualLogger } from '../../core/logger/logger.js';

const router = Router();
const logger = createContextualLogger({ module: 'SearchRoutes' });

/**
 * Hybrid Search
 * POST /api/search/hybrid
 * Body: { query: string, limit?: number, filters?: object }
 */
router.post('/hybrid', async (req, res) => {
    try {
        const { query, limit, filters, semanticWeight, keywordWeight } = req.body;

        if (!query) {
            return res.status(400).json({ success: false, error: 'Query is required' });
        }

        const results = await hybridSearchService.search(query, {
            limit: limit || 10,
            filters: filters || {},
            semanticWeight,
            keywordWeight
        });

        res.json({
            success: true,
            count: results.length,
            data: results
        });
    } catch (error: any) {
        logger.error(`Search failed: ${error.message}`);
        res.status(500).json({ success: false, error: 'Search failed' });
    }
});

/**
 * STAGE 27: Advanced Search with Filters
 * POST /api/search
 * Body: { query: string, filters?: { dateFrom, dateTo, model, folder } }
 */
router.post('/', authMiddleware, async (req: CustomRequest, res) => {
    try {
        const userId = req.user?.id;
        const { query, filters = {} } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!query || !query.trim()) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        // Extract optional params
        const limit = req.body.limit ? parseInt(req.body.limit) : 20;
        const mode = req.body.mode || 'basic';

        // Delegate to unified search service (which uses robust Aggregation pipeline)
        const conversationService = (await import('../../modules/conversation/conversation.service.js')).default;
        const results = await conversationService.searchConversations(userId, query, limit, mode, filters);

        logger.info(`Search completed: "${query}" - ${results.length} results`);

        res.json({ results });
    } catch (error: any) {
        logger.error('Search failed', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

export default router;


