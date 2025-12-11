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
        const { query, filters = {}, mode = 'basic' } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!query || !query.trim()) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        // Use hybrid search for semantic or hybrid modes
        if (mode === 'semantic' || mode === 'hybrid') {
            const semanticWeight = mode === 'semantic' ? 1.0 : 0.7;
            const keywordWeight = mode === 'semantic' ? 0.0 : 0.3;

            const results = await hybridSearchService.search(query, {
                limit: 20,
                filters,
                semanticWeight,
                keywordWeight
            });

            logger.info(`Search completed (${mode}): "${query}" - ${results.length} results`);

            return res.json({
                results: results.map(r => ({
                    conversationId: r.id,
                    title: r.metadata?.title || 'Untitled Conversation',
                    snippet: r.content.substring(0, 150) + '...',
                    score: r.score,
                    createdAt: r.metadata?.createdAt,
                    model: r.metadata?.model
                }))
            });
        }

        // Basic mode: Use MongoDB text search
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

        logger.info(`Search completed (basic): "${query}" - ${results.length} results`);

        res.json({ results });
    } catch (error: any) {
        logger.error('Search failed', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

export default router;


