// STAGE 1: File validation middleware
import { Request, Response, NextFunction } from 'express';
import { FILE_SIZE_LIMITS, ALLOWED_MIME_TYPES } from '../config/multer.config.js';

export const validateFileUpload = (fileType: 'image' | 'document' | 'audio' | 'mixed' = 'document') => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.file && !req.files) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const files = req.files
            ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat())
            : [req.file];

        for (const file of files) {
            if (!file) continue;

            // Check file size
            const maxSize = FILE_SIZE_LIMITS[fileType] || FILE_SIZE_LIMITS.default;
            if (file.size > maxSize) {
                return res.status(400).json({
                    error: `File too large: ${file.originalname}. Max size: ${maxSize / 1024 / 1024}MB`
                });
            }

            // Check MIME type
            const allowedTypes = ALLOWED_MIME_TYPES[fileType];
            if (allowedTypes && !allowedTypes.includes(file.mimetype)) {
                return res.status(400).json({
                    error: `Invalid file type: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`
                });
            }
        }

        next();
    };
};
