// src/modules/file/file.routes.ts
import { Router } from 'express';
import fileController from './file.controller.js';
import { upload } from '../../config/multer.config.js';
import { validate } from '../../middleware/zod.middleware.js';
import { z } from 'zod';

const router = Router();

// Validation schemas
const fileIdParamSchema = z.object({
    params: z.object({
        fileId: z.string().uuid('Invalid file ID format')
    })
});

// Upload file
router.post('/upload', upload.single('file'), (req, res) => fileController.uploadFile(req, res));

// Get file metadata
router.get('/:fileId', validate(fileIdParamSchema), (req, res) => fileController.getFile(req, res));

// Download file
router.get('/:fileId/download', validate(fileIdParamSchema), (req, res) => fileController.downloadFile(req, res));

// Delete file
router.delete('/:fileId', validate(fileIdParamSchema), (req, res) => fileController.deleteFile(req, res));

// Get user's files
router.get('/', (req, res) => fileController.getUserFiles(req, res));

export default router;
