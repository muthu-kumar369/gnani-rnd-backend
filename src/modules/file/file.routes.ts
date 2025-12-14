// src/modules/file/file.routes.ts
import { Router } from 'express';
import fileController from './file.controller.js';
import { upload } from '../../config/multer.config.js';
import { validate } from '../../middleware/zod.middleware.js';
import { validateFileUpload } from '../../middleware/file-validation.middleware.js'; // STAGE 1
import { authMiddleware, authMiddleware as authorize } from '../../core/security/auth.middleware.js';
import { z } from 'zod';

const router = Router();

// Validation schemas
const fileIdParamSchema = z.object({
    params: z.object({
        fileId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid file ID format')
    })
});

// Upload file - STAGE 1: Added file validation middleware
router.post('/upload',
    authMiddleware,
    upload.single('file'),
    validateFileUpload('mixed'), // STAGE 1: Validate file size and type
    (req, res) => fileController.uploadFile(req, res)
);

// Get file metadata
router.get('/:fileId', authMiddleware, validate(fileIdParamSchema), (req, res) => fileController.getFile(req, res));

// Download file
router.get('/:fileId/download', authMiddleware, validate(fileIdParamSchema), (req, res) => fileController.downloadFile(req, res));

// Delete file
router.delete('/:fileId', authMiddleware, validate(fileIdParamSchema), (req, res) => fileController.deleteFile(req, res));

// Get user's files
router.get('/', authMiddleware, (req, res) => fileController.getUserFiles(req, res));

export default router;
