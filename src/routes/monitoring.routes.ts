// gnani-rnd-backend/src/routes/monitoring.routes.ts

import express from 'express';
import redisClient from '../config/redis.config.js';
import mongoose from 'mongoose';

const router = express.Router();

router.get('/memory', async (req, res) => {
    const memory = {
        redis: {
            used: 0,
            keys: 0,
            maxMemory: 0
        },
        mongodb: {
            collections: {} as Record<string, { size: number; count: number }>,
            totalSize: 0
        },
        process: {
            heapUsed: process.memoryUsage().heapUsed,
            heapTotal: process.memoryUsage().heapTotal,
            rss: process.memoryUsage().rss,
            external: process.memoryUsage().external
        },
        timestamp: Date.now()
    };

    try {
        // Redis stats
        const redisInfo = await redisClient.info('memory');
        const usedMatch = redisInfo.match(/used_memory:(\d+)/);
        const maxMatch = redisInfo.match(/maxmemory:(\d+)/);

        memory.redis.used = parseInt(usedMatch?.[1] || '0');
        memory.redis.maxMemory = parseInt(maxMatch?.[1] || '0');

        const dbSize = await redisClient.dbsize();
        memory.redis.keys = dbSize;

        // MongoDB stats
        if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
            const db = mongoose.connection.db;
            const stats = await db.stats();
            memory.mongodb.totalSize = stats.dataSize;

            // Get collection stats
            const collections = await db.listCollections().toArray();
            for (const col of collections) {
                const colStats = await db.command({ collStats: col.name });
                memory.mongodb.collections[col.name] = {
                    size: colStats.size || 0,
                    count: colStats.count || 0
                };
            }
        }

        res.json(memory);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// System metrics
router.get('/metrics', async (req, res) => {
    const metrics = {
        uptime: process.uptime(),
        cpu: process.cpuUsage(),
        memory: process.memoryUsage(),
        platform: process.platform,
        nodeVersion: process.version,
        timestamp: Date.now()
    };

    res.json(metrics);
});

export default router;
