// src/config/multer.config.ts
import multer from 'multer';

// STAGE 1: Specific file size limits per type
export const FILE_SIZE_LIMITS = {
    image: 10 * 1024 * 1024, // 10MB
    document: 50 * 1024 * 1024, // 50MB
    audio: 100 * 1024 * 1024, // 100MB
    default: 10 * 1024 * 1024, // 10MB
};

export const ALLOWED_MIME_TYPES = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg'],
    document: [
        'application/pdf',
        'text/plain',
        'text/markdown',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    audio: ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg'],
};

// Use memory storage to support both S3 and local
const storage = multer.memoryStorage();

// File type validation
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allAllowedTypes = Object.values(ALLOWED_MIME_TYPES).flat();

    if (allAllowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type: ${file.mimetype}. Only PDF, DOC, DOCX, TXT, MD, and images are allowed.`));
    }
};

export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: FILE_SIZE_LIMITS.default,
        files: 10, // STAGE 1: Max 10 files per request
    }
});
