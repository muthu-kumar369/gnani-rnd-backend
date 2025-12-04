// src/modules/vision/vision.routes.ts
import { Router } from 'express';
import visionController from './vision.controller.js';
import { upload } from '../../config/multer.config.js';

const router = Router();

// Analyze single image
router.post('/analyze', upload.single('image'), (req, res) => visionController.analyzeImage(req, res));

// Analyze multiple images
router.post('/batch-analyze', upload.array('images', 5), (req, res) => visionController.analyzeBatch(req, res));

// Check vision service status
router.get('/status', (req, res) => visionController.getStatus(req, res));

export default router;
