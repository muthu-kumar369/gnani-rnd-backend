// src/config/multer.config.ts
import multer from 'multer';

// Use memory storage to support both S3 and local
const storage = multer.memoryStorage();

// File type validation
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = [
        // Documents
        'application/pdf',
        'text/plain',
        'text/markdown',
        'application/msword', // .doc
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        // Images
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/gif',
        'image/webp'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF, DOC, DOCX, TXT, and MD files are allowed.'));
    }
};

export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});
