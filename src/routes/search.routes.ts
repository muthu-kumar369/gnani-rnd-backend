import { Router, Request, Response } from 'express';

import { authMiddleware, type CustomRequest } from '../core/security/auth.middleware.js';
import { createContextualLogger } from '../core/logger/logger.js';

const router = Router();
const logger = createContextualLogger({ module: 'SearchRoutes' });

// POST /api/search - Advanced search with filters
router.post('/', authMiddleware, async (req: CustomRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { query, filters = {} } = req.body;

        // EMERGENCY DEBUG LOG
        try {
            const fs = await import('fs');
            const path = await import('path');
            const logPath = path.join(process.cwd(), 'debug_search.log');
            const logEntry = `[${new Date().toISOString()}] User: ${userId}, Query: ${query}, Filters: ${JSON.stringify(filters)}, Mode: ${req.body.mode}, Limit: ${req.body.limit}\n`;
            fs.appendFileSync(logPath, logEntry);
        } catch (e) { /* ignore */ }

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!query || !query.trim()) {
            return res.status(400).json({ error: 'Search query is required' });
        }


        // Extract optional params
        const limit = req.body.limit ? parseInt(req.body.limit) : 20;
        const mode = req.body.mode || 'basic';

        // Delegate to unified search service
        const conversationService = (await import('../modules/conversation/conversation.service.js')).default;
        const serviceResponse: any = await conversationService.searchConversations(userId, query, limit, mode, filters);

        // Debug mode pass-through
        if (serviceResponse.debug) {
            res.json(serviceResponse); // Returns { debug, results }
            return;
        }

        const results = serviceResponse; // Fallback if regular array (once we revert)

        logger.info(`Search completed: "${query}" - ${results.length} results`);

        res.json({ results });
    } catch (error) {
        logger.error('Search failed', error as Error);
        res.status(500).json({ error: 'Search failed' });
    }
});

export default router;
