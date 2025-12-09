// src/modules/analytics/analytics.routes.ts
import { Router } from 'express';
import analyticsService from './analytics.service.js';
import { createContextualLogger } from '../../core/logger/logger.js';

const router = Router();
const logger = createContextualLogger({ module: 'AnalyticsRoutes' });

/**
 * Get Dashboard Stats
 * GET /api/analytics/dashboard
 */
router.get('/dashboard', async (req, res) => {
    try {
        const stats = await analyticsService.getDashboardStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error: any) {
        logger.error(`Failed to get analytics dashboard: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to get dashboard stats' });
    }
});

/**
 * Get Daily Activity
 * GET /api/analytics/activity
 */
router.get('/activity', async (req, res) => {
    try {
        const activity = await analyticsService.getDailyActivity();
        res.json({
            success: true,
            data: activity
        });
    } catch (error: any) {
        logger.error(`Failed to get activity stats: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to get activity stats' });
    }
});

export default router;
