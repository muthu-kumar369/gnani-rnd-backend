// src/modules/file/file.controller.ts
import { Request, Response } from 'express';
import fileService from './file.service.js';
import { createContextualLogger } from '../../core/logger/logger.js';
import { CustomRequest } from '../../core/security/auth.middleware.js';

const logger = createContextualLogger({ module: 'FileController' });

class FileController {
    /**
     * Upload file
     * POST /api/files/upload
     */
    async uploadFile(req: CustomRequest, res: Response): Promise<void> {
        try {
            if (!req.file) {
                res.status(400).json({ error: 'No file provided' });
                return;
            }

            const userId = req.fullUser?.userId || req.body.userId;
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const file = await fileService.uploadFile(req.file, userId);

            res.status(201).json({
                success: true,
                file: {
                    id: file._id,
                    fileName: file.fileName,
                    fileSize: file.fileSize,
                    mimeType: file.mimeType,
                    storageMode: file.storageMode,
                    parsedContentPreview: file.parsedContent.substring(0, 200),
                    uploadedAt: file.uploadedAt,
                    url: `/api/v1/files/${file._id}/download`
                }
            });
        } catch (error: any) {
            logger.error(`File upload error: ${error.message}`);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get file metadata
     * GET /api/files/:fileId
     */
    async getFile(req: CustomRequest, res: Response): Promise<void> {
        try {
            const { fileId } = req.params;
            const userId = req.fullUser?.userId || req.query.userId as string;

            const file = await fileService.getFile(fileId, userId);
            if (!file) {
                res.status(404).json({ error: 'File not found' });
                return;
            }

            res.json({
                success: true,
                file: {
                    id: file._id,
                    fileName: file.fileName,
                    fileSize: file.fileSize,
                    mimeType: file.mimeType,
                    parsedContent: file.parsedContent,
                    uploadedAt: file.uploadedAt
                }
            });
        } catch (error: any) {
            logger.error(`Get file error: ${error.message}`);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Download file
     * GET /api/files/:fileId/download
     */
    async downloadFile(req: CustomRequest, res: Response): Promise<void> {
        try {
            const { fileId } = req.params;
            const userId = req.fullUser?.userId || req.query.userId as string;

            const { buffer, file } = await fileService.getFileBuffer(fileId, userId);

            res.setHeader('Content-Type', file.mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
            res.send(buffer);
        } catch (error: any) {
            logger.error(`Download file error: ${error.message}`);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Delete file
     * DELETE /api/files/:fileId
     */
    async deleteFile(req: CustomRequest, res: Response): Promise<void> {
        try {
            const { fileId } = req.params;
            const userId = req.fullUser?.userId || req.body.userId;

            await fileService.deleteFile(fileId, userId);

            res.json({ success: true, message: 'File deleted' });
        } catch (error: any) {
            logger.error(`Delete file error: ${error.message}`);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get user's files
     * GET /api/files
     */
    async getUserFiles(req: CustomRequest, res: Response): Promise<void> {
        try {
            const userId = req.fullUser?.userId || req.query.userId as string;
            const limit = parseInt(req.query.limit as string) || 20;

            const files = await fileService.getUserFiles(userId, limit);

            res.json({
                success: true,
                files: files.map(f => ({
                    id: f._id,
                    fileName: f.fileName,
                    fileSize: f.fileSize,
                    mimeType: f.mimeType,
                    uploadedAt: f.uploadedAt
                }))
            });
        } catch (error: any) {
            logger.error(`Get user files error: ${error.message}`);
            res.status(500).json({ error: error.message });
        }
    }
}

export default new FileController();
