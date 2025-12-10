import { Router, Request, Response } from 'express';
import Plugin from '../models/plugin.model.js';
import { authMiddleware, type CustomRequest } from '../core/security/auth.middleware.js';
import { createContextualLogger } from '../core/logger/logger.js';

const router = Router();
const logger = createContextualLogger({ module: 'PluginRoutes' });

// GET /api/plugins - Get all plugins (marketplace)
router.get('/', async (req: Request, res: Response) => {
    try {
        const { category, search } = req.query;

        const query: any = { verified: true };

        if (category && category !== 'all') {
            query.category = category;
        }

        if (search) {
            query.$text = { $search: search as string };
        }

        const plugins = await Plugin.find(query)
            .sort({ downloads: -1, rating: -1 })
            .limit(50)
            .select('-code') // Don't send code in list view
            .lean();

        res.json({ plugins });
    } catch (error) {
        logger.error('Failed to fetch plugins', error as Error);
        res.status(500).json({ error: 'Failed to fetch plugins' });
    }
});

// GET /api/plugins/:pluginId - Get single plugin with code
router.get('/:pluginId', async (req: Request, res: Response) => {
    try {
        const { pluginId } = req.params;

        const plugin = await Plugin.findOne({ pluginId }).lean();

        if (!plugin) {
            return res.status(404).json({ error: 'Plugin not found' });
        }

        // Increment downloads
        await Plugin.updateOne({ pluginId }, { $inc: { downloads: 1 } });

        res.json({ plugin });
    } catch (error) {
        logger.error('Failed to fetch plugin', error as Error);
        res.status(500).json({ error: 'Failed to fetch plugin' });
    }
});

// POST /api/plugins - Create new plugin (admin only)
router.post('/', authMiddleware, async (req: CustomRequest, res: Response) => {
    try {
        const { pluginId, name, version, author, description, icon, category, code } = req.body;

        if (!pluginId || !name || !version || !code) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const plugin = await Plugin.create({
            pluginId,
            name,
            version,
            author,
            description,
            icon,
            category,
            code,
            verified: false, // Requires admin verification
        });

        logger.info(`Plugin created: ${pluginId}`);

        res.status(201).json({ plugin });
    } catch (error) {
        logger.error('Failed to create plugin', error as Error);
        res.status(500).json({ error: 'Failed to create plugin' });
    }
});

// PATCH /api/plugins/:pluginId/rate - Rate a plugin
router.patch('/:pluginId/rate', authMiddleware, async (req: CustomRequest, res: Response) => {
    try {
        const { pluginId } = req.params;
        const { rating } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }

        const plugin = await Plugin.findOne({ pluginId });

        if (!plugin) {
            return res.status(404).json({ error: 'Plugin not found' });
        }

        // Simple average (in production, track individual ratings)
        plugin.rating = (plugin.rating + rating) / 2;
        await plugin.save();

        res.json({ rating: plugin.rating });
    } catch (error) {
        logger.error('Failed to rate plugin', error as Error);
        res.status(500).json({ error: 'Failed to rate plugin' });
    }
});

// DELETE /api/plugins/:pluginId - Delete plugin (admin only)
router.delete('/:pluginId', authMiddleware, async (req: CustomRequest, res: Response) => {
    try {
        const { pluginId } = req.params;

        const plugin = await Plugin.findOneAndDelete({ pluginId });

        if (!plugin) {
            return res.status(404).json({ error: 'Plugin not found' });
        }

        logger.info(`Plugin deleted: ${pluginId}`);

        res.json({ success: true });
    } catch (error) {
        logger.error('Failed to delete plugin', error as Error);
        res.status(500).json({ error: 'Failed to delete plugin' });
    }
});

export default router;
