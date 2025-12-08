// src/routes/metrics.routes.ts
// Stage 6: Prometheus metrics endpoint
import express from 'express';
import metrics from '../core/monitoring/metrics.js';

const router = express.Router();

/**
 * GET /metrics
 * Prometheus metrics endpoint
 */
router.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', metrics.registry.contentType);
        res.end(await metrics.registry.metrics());
    } catch (error: any) {
        res.status(500).end(error.message);
    }
});

export default router;
