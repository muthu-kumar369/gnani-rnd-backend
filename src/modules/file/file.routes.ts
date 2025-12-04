// src/modules/file/file.routes.ts
import { Router } from 'express';
import fileController from './file.controller.js';
import { upload } from '../../config/multer.config.js';

const router = Router();

// Upload file
router.post('/upload', upload.single('file'), (req, res) => fileController.uploadFile(req, res));

// Get file metadata
router.get('/:fileId', (req, res) => fileController.getFile(req, res));

// Download file
router.get('/:fileId/download', (req, res) => fileController.downloadFile(req, res));

// Delete file
router.delete('/:fileId', (req, res) => fileController.deleteFile(req, res));

// Get user's files
router.get('/', (req, res) => fileController.getUserFiles(req, res));

export default router;
