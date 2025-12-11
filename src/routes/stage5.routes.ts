import { Router } from 'express';
import { semanticSearchService } from '../modules/search/semantic-search.service.js';
import { facetedSearchService } from '../modules/search/faceted-search.service.js';
import { searchSuggestionsService } from '../modules/search/search-suggestions.service.js';
import { ragPipelineService } from '../modules/memory/rag-pipeline.service.js';
import { anomalyDetectionService } from '../modules/analytics/anomaly-detection.service.js';
import { cacheWarmingService } from '../modules/cache/cache-warming.service.js';
import { tieredCache } from '../modules/cache/tiered-cache.service.js';
import logger from '../core/logger/logger.js';

const router = Router();

/**
 * Stage 5 Advanced Features Routes
 * Note: Authentication temporarily disabled for testing
 */

// Semantic Search
router.post('/search/semantic', async (req, res) => {
    try {
        const { query, limit = 20 } = req.body;
        const userId = "test-user"; // TODO: Add authentication

        const results = await semanticSearchService.search(query, userId, limit);
        res.json({ results, count: results.length });
    } catch (error: any) {
        logger.error('Semantic search failed', error);
        res.status(500).json({ error: error.message });
    }
});

// Faceted Search
router.post('/search/faceted', async (req, res) => {
    try {
        const { query, filters } = req.body;
        const userId = "test-user"; // TODO: Add authentication

        const results = await facetedSearchService.search(query, filters, userId);
        res.json({ results, count: results.length });
    } catch (error: any) {
        logger.error('Faceted search failed', error);
        res.status(500).json({ error: error.message });
    }
});

// Get Search Facets
router.get('/search/facets', async (req, res) => {
    try {
        const { query } = req.query;
        const userId = "test-user"; // TODO: Add authentication

        const facets = await facetedSearchService.getFacets(query as string, userId);
        res.json({ facets });
    } catch (error: any) {
        logger.error('Get facets failed', error);
        res.status(500).json({ error: error.message });
    }
});

// Search Suggestions
router.get('/search/suggestions', async (req, res) => {
    try {
        const { prefix, limit = 5 } = req.query;
        const userId = "test-user"; // TODO: Add authentication

        const suggestions = searchSuggestionsService.getSuggestions(
            prefix as string,
            userId,
            Number(limit)
        );

        res.json({ suggestions });
    } catch (error: any) {
        logger.error('Get suggestions failed', error);
        res.status(500).json({ error: error.message });
    }
});

// Record Search Query
router.post('/search/record', async (req, res) => {
    try {
        const { query } = req.body;
        const userId = "test-user"; // TODO: Add authentication

        await searchSuggestionsService.recordQuery(userId, query);
        res.json({ success: true });
    } catch (error: any) {
        logger.error('Record query failed', error);
        res.status(500).json({ error: error.message });
    }
});

// RAG Retrieval
router.post('/rag/retrieve', async (req, res) => {
    try {
        const { query, k = 5 } = req.body;
        const userId = "test-user"; // TODO: Add authentication

        const results = await ragPipelineService.retrieve(query, userId, k);
        res.json({ results, count: results.length });
    } catch (error: any) {
        logger.error('RAG retrieval failed', error);
        res.status(500).json({ error: error.message });
    }
});

// Anomaly Detection
router.get('/analytics/anomalies', async (req, res) => {
    try {
        const userId = "test-user"; // TODO: Add authentication

        const anomalies = await anomalyDetectionService.detectAnomalies(userId);
        res.json({ anomalies, count: anomalies.length });
    } catch (error: any) {
        logger.error('Anomaly detection failed', error);
        res.status(500).json({ error: error.message });
    }
});

// Cache Warming
router.post('/cache/warm', async (req, res) => {
    try {
        const userId = "test-user"; // TODO: Add authentication

        await cacheWarmingService.warmPredictively(userId);
        res.json({ success: true });
    } catch (error: any) {
        logger.error('Cache warming failed', error);
        res.status(500).json({ error: error.message });
    }
});

// Cache Stats
router.get('/cache/stats', async (req, res) => {
    try {
        const stats = tieredCache.getStats();
        res.json({ stats });
    } catch (error: any) {
        logger.error('Get cache stats failed', error);
        res.status(500).json({ error: error.message });
    }
});

// Index Document (for semantic search)
router.post('/search/index', async (req, res) => {
    try {
        const { document } = req.body;
        const userId = "test-user"; // TODO: Add authentication

        await semanticSearchService.indexDocument(document, userId);
        res.json({ success: true });
    } catch (error: any) {
        logger.error('Document indexing failed', error);
        res.status(500).json({ error: error.message });
    }
});

// Batch Index Documents
router.post('/search/index/batch', async (req, res) => {
    try {
        const { documents } = req.body;
        const userId = "test-user"; // TODO: Add authentication

        await semanticSearchService.indexBatch(documents, userId);
        res.json({ success: true, count: documents.length });
    } catch (error: any) {
        logger.error('Batch indexing failed', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
