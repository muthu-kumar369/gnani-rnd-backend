// src/modules/vision/vision.controller.ts
import { Request, Response } from 'express';
import visionService from './vision.service.js';
import { createContextualLogger } from '../../core/logger/logger.js';

const logger = createContextualLogger({ module: 'VisionController' });

class VisionController {
    /**
     * Analyze single image
     * POST /api/vision/analyze
     */
    async analyzeImage(req: Request, res: Response): Promise<void> {
        try {
            if (!req.file) {
                res.status(400).json({ error: 'No image provided' });
                return;
            }

            const prompt = req.body.prompt as string | undefined;
            const result = await visionService.processImage(req.file.buffer, prompt);

            res.json({
                success: true,
                analysis: result.analysis,
                metadata: result.metadata,
                cacheKey: result.cacheKey
            });
        } catch (error: any) {
            logger.error(`Vision analysis error: ${error.message}`);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Analyze multiple images
     * POST /api/vision/batch-analyze
     */
    async analyzeBatch(req: Request, res: Response): Promise<void> {
        try {
            const files = req.files as Express.Multer.File[];
            if (!files || files.length === 0) {
                res.status(400).json({ error: 'No images provided' });
                return;
            }

            const prompt = req.body.prompt as string | undefined;
            const buffers = files.map(f => f.buffer);

            const results = await visionService.processMultipleImages(buffers, prompt);

            res.json({
                success: true,
                results: results.map((r, i) => ({
                    imageIndex: i,
                    analysis: r.analysis,
                    metadata: r.metadata
                }))
            });
        } catch (error: any) {
            logger.error(`Batch vision analysis error: ${error.message}`);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Check vision service status
     * GET /api/vision/status
     */
    async getStatus(req: Request, res: Response): Promise<void> {
        try {
            const available = await visionService.isAvailable();

            res.json({
                success: true,
                available,
                message: available ? 'Vision service is ready' : 'Vision service is not available'
            });
        } catch (error: any) {
            logger.error(`Status check error: ${error.message}`);
            res.status(500).json({ error: error.message });
        }
    }
}

export default new VisionController();
