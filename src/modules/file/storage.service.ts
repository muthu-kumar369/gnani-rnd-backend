// src/modules/file/storage.service.ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createContextualLogger } from '../../core/logger/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { Logger } from 'winston';

class StorageService {
    private logger: Logger;
    private s3Client: S3Client | null = null;
    private storageMode: 's3' | 'local';
    private bucket: string;
    private localUploadPath: string;

    constructor() {
        this.logger = createContextualLogger({ module: 'StorageService' });
        this.bucket = process.env.AWS_S3_BUCKET || '';
        this.localUploadPath = path.join(process.cwd(), 'uploads');

        // Auto-detect storage mode
        if (process.env.FILE_STORAGE_MODE === 'local') {
            this.storageMode = 'local';
            this.logger.info('Storage mode: LOCAL (forced by env)');
        } else if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && this.bucket) {
            this.storageMode = 's3';
            this.s3Client = new S3Client({
                region: process.env.AWS_REGION || 'us-east-1',
                credentials: {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
                }
            });
            this.logger.info(`Storage mode: S3 (bucket: ${this.bucket})`);
        } else {
            this.storageMode = 'local';
            this.logger.info('Storage mode: LOCAL (S3 credentials not configured)');
        }

        // Ensure local upload directory exists
        this.ensureUploadDirectory();
    }

    private async ensureUploadDirectory(): Promise<void> {
        try {
            await fs.mkdir(this.localUploadPath, { recursive: true });
            this.logger.debug(`Upload directory ensured: ${this.localUploadPath}`);
        } catch (error: any) {
            this.logger.error(`Failed to create upload directory: ${error.message}`);
        }
    }

    /**
     * Upload file to S3 or local storage
     */
    async uploadFile(buffer: Buffer, filename: string, mimetype: string): Promise<{ key: string; mode: 's3' | 'local' }> {
        const fileKey = `${Date.now()}-${filename}`;

        // Try S3 first if configured
        if (this.storageMode === 's3' && this.s3Client) {
            try {
                await this.uploadToS3(buffer, fileKey, mimetype);
                this.logger.info(`File uploaded to S3: ${fileKey}`);
                return { key: fileKey, mode: 's3' };
            } catch (error: any) {
                this.logger.warn(`S3 upload failed, falling back to local: ${error.message}`);
                // Fallback to local
            }
        }

        // Upload to local storage
        await this.uploadToLocal(buffer, fileKey);
        this.logger.info(`File uploaded to local storage: ${fileKey}`);
        return { key: fileKey, mode: 'local' };
    }

    /**
     * Upload to S3
     */
    private async uploadToS3(buffer: Buffer, key: string, mimetype: string): Promise<void> {
        if (!this.s3Client) {
            throw new Error('S3 client not initialized');
        }

        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: buffer,
            ContentType: mimetype
        });

        await this.s3Client.send(command);
    }

    /**
     * Upload to local filesystem
     */
    private async uploadToLocal(buffer: Buffer, key: string): Promise<void> {
        const filePath = path.join(this.localUploadPath, key);
        await fs.writeFile(filePath, buffer);
    }

    /**
     * Get file from S3 or local storage
     */
    async getFile(fileKey: string, storageMode: 's3' | 'local'): Promise<Buffer> {
        if (storageMode === 's3' && this.s3Client) {
            try {
                return await this.getFromS3(fileKey);
            } catch (error: any) {
                this.logger.warn(`S3 download failed, trying local: ${error.message}`);
                // Fallback to local
            }
        }

        return await this.getFromLocal(fileKey);
    }

    /**
     * Get from S3
     */
    private async getFromS3(key: string): Promise<Buffer> {
        if (!this.s3Client) {
            throw new Error('S3 client not initialized');
        }

        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key
        });

        const response = await this.s3Client.send(command);
        const stream = response.Body as any;

        // Convert stream to buffer
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    }

    /**
     * Get from local filesystem
     */
    private async getFromLocal(key: string): Promise<Buffer> {
        const filePath = path.join(this.localUploadPath, key);
        return await fs.readFile(filePath);
    }

    /**
     * Delete file from S3 or local storage
     */
    async deleteFile(fileKey: string, storageMode: 's3' | 'local'): Promise<void> {
        if (storageMode === 's3' && this.s3Client) {
            try {
                await this.deleteFromS3(fileKey);
                this.logger.info(`File deleted from S3: ${fileKey}`);
                return;
            } catch (error: any) {
                this.logger.warn(`S3 delete failed, trying local: ${error.message}`);
            }
        }

        await this.deleteFromLocal(fileKey);
        this.logger.info(`File deleted from local storage: ${fileKey}`);
    }

    /**
     * Delete from S3
     */
    private async deleteFromS3(key: string): Promise<void> {
        if (!this.s3Client) {
            throw new Error('S3 client not initialized');
        }

        const command = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key
        });

        await this.s3Client.send(command);
    }

    /**
     * Delete from local filesystem
     */
    private async deleteFromLocal(key: string): Promise<void> {
        const filePath = path.join(this.localUploadPath, key);
        try {
            await fs.unlink(filePath);
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
            // File doesn't exist, that's fine
        }
    }

    /**
     * Get current storage mode
     */
    getStorageMode(): 's3' | 'local' {
        return this.storageMode;
    }
}

export default new StorageService();
