// gnani-rnd-backend/src/routes/queue.routes.ts

import express from 'express';
import { toolQueue } from '../queues/tool.queue.js';

const router = express.Router();

// Get queue stats
router.get('/stats', async (req, res) => {
    try {
        const waiting = await toolQueue.getWaitingCount();
        const active = await toolQueue.getActiveCount();
        const completed = await toolQueue.getCompletedCount();
        const failed = await toolQueue.getFailedCount();

        res.json({
            waiting,
            active,
            completed,
            failed,
            timestamp: Date.now()
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get job details
router.get('/jobs/:jobId', async (req, res) => {
    try {
        const job = await toolQueue.getJob(req.params.jobId);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const state = await job.getState();
        const progress = job.progress;

        res.json({
            id: job.id,
            state,
            progress,
            data: job.data,
            timestamp: job.timestamp
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Clean completed jobs
router.post('/clean', async (req, res) => {
    try {
        await toolQueue.clean(3600000, 100, 'completed'); // Clean jobs older than 1 hour
        await toolQueue.clean(3600000, 100, 'failed');

        res.json({ message: 'Queue cleaned successfully' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
