// src/modules/search/search.routes.ts
import { Router } from 'express';
import hybridSearchService from './hybrid-search.service.js';
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

export default router;
