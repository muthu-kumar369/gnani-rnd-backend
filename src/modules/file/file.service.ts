// src/modules/file/file.service.ts
import File, { IFile } from './file.model.js';
import storageService from './storage.service.js';
import { parsePDF } from './parsers/pdf.parser.js';
import { parseDOCX } from './parsers/doc.parser.js';
import { parseText } from './parsers/text.parser.js';
import { optimizeImage, extractImageMetadata, isValidImageFormat } from './parsers/image.parser.js';
import visionService from '../vision/vision.service.js';
import { createContextualLogger } from '../../core/logger/logger.js';
import { Logger } from 'winston';

class FileService {
    private logger: Logger;

    constructor() {
        this.logger = createContextualLogger({ module: 'FileService' });
    }

    /**
     * Upload file, parse content, and store metadata
     */
    async uploadFile(file: Express.Multer.File, userId: string): Promise<IFile> {
        try {
            this.logger.info(`Uploading file: ${file.originalname} (${file.size} bytes)`);

            // Check if it's an image
            const isImage = isValidImageFormat(file.mimetype);
            let parsedContent = '';
            let visionAnalysis = '';

            if (isImage) {
                // Process image
                try {
                    const optimized = await optimizeImage(file.buffer);
                    // Upload optimized version
                    const { key, mode } = await storageService.uploadFile(
                        optimized,
                        file.originalname,
                        file.mimetype
                    );

                    // Generate vision analysis
                    try {
                        const result = await visionService.processImage(file.buffer);
                        visionAnalysis = result.analysis;
                        this.logger.info(`Vision analysis completed for ${file.originalname}`);
                    } catch (visionError: any) {
                        this.logger.warn(`Vision analysis failed: ${visionError.message}`);
                    }

                    // Create file document
                    const fileDoc = await File.create({
                        userId,
                        fileName: file.originalname,
                        fileKey: key,
                        fileSize: file.size,
                        mimeType: file.mimetype,
                        storageMode: mode,
                        parsedContent: visionAnalysis,
                        uploadedAt: new Date()
                    });

                    this.logger.info(`Image uploaded successfully: ${fileDoc._id}`);
                    return fileDoc;
                } catch (imageError: any) {
                    this.logger.error(`Image processing failed: ${imageError.message}`);
                    throw imageError;
                }
            } else {
                // Process document (existing logic)
                const { key, mode } = await storageService.uploadFile(
                    file.buffer,
                    file.originalname,
                    file.mimetype
                );

                // Parse file content
                try {
                    parsedContent = await this.parseFileContent(file.buffer, file.mimetype);
                    this.logger.debug(`Parsed ${parsedContent.length} characters from ${file.originalname}`);
                } catch (parseError: any) {
                    this.logger.warn(`Failed to parse file content: ${parseError.message}`);
                }

                // Create file document
                const fileDoc = await File.create({
                    userId,
                    fileName: file.originalname,
                    fileKey: key,
                    fileSize: file.size,
                    mimeType: file.mimetype,
                    storageMode: mode,
                    parsedContent,
                    uploadedAt: new Date()
                });

                this.logger.info(`File uploaded successfully: ${fileDoc._id}`);
                return fileDoc;
            }
        } catch (error: any) {
            this.logger.error(`File upload failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Parse file content based on MIME type
     */
    private async parseFileContent(buffer: Buffer, mimeType: string): Promise<string> {
        switch (mimeType) {
            case 'application/pdf':
                return await parsePDF(buffer);

            case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                return await parseDOCX(buffer);

            case 'text/plain':
            case 'text/markdown':
                return await parseText(buffer);

            case 'application/msword':
                // Legacy .doc files - try DOCX parser (may not work)
                try {
                    return await parseDOCX(buffer);
                } catch {
                    return await parseText(buffer); // Fallback to text
                }

            default:
                throw new Error(`Unsupported file type: ${mimeType}`);
        }
    }

    /**
     * Get file metadata
     */
    async getFile(fileId: string, userId: string): Promise<IFile | null> {
        const file = await File.findOne({ _id: fileId, userId });
        return file;
    }

    /**
     * Get file buffer for download
     */
    async getFileBuffer(fileId: string, userId: string): Promise<{ buffer: Buffer; file: IFile }> {
        const file = await this.getFile(fileId, userId);
        if (!file) {
            throw new Error('File not found');
        }

        const buffer = await storageService.getFile(file.fileKey, file.storageMode);
        return { buffer, file };
    }

    /**
     * Delete file
     */
    async deleteFile(fileId: string, userId: string): Promise<void> {
        const file = await this.getFile(fileId, userId);
        if (!file) {
            throw new Error('File not found');
        }

        // Delete from storage
        await storageService.deleteFile(file.fileKey, file.storageMode);

        // Delete from database
        await File.deleteOne({ _id: fileId });

        this.logger.info(`File deleted: ${fileId}`);
    }

    /**
     * Get user's files
     */
    async getUserFiles(userId: string, limit: number = 20): Promise<IFile[]> {
        return await File.find({ userId })
            .sort({ uploadedAt: -1 })
            .limit(limit)
            .lean() as unknown as IFile[];
    }
}

export default new FileService();
