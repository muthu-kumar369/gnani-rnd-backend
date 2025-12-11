// src/modules/vision/vision.routes.ts
import { Router } from 'express';
import visionController from './vision.controller.js';
import { upload } from '../../config/multer.config.js';
import { validateFileUpload } from '../../middleware/file-validation.middleware.js'; // STAGE 1

const router = Router();

// Analyze single image - STAGE 1: Added file validation
router.post('/analyze', upload.single('image'), validateFileUpload('image'), (req, res) => visionController.analyzeImage(req, res));

// Analyze multiple images - STAGE 1: Added file validation
router.post('/batch-analyze', upload.array('images', 5), validateFileUpload('image'), (req, res) => visionController.analyzeBatch(req, res));

// Check vision service status
router.get('/status', (req, res) => visionController.getStatus(req, res));

export default router;
