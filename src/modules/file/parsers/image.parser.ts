// src/modules/file/parsers/image.parser.ts
import sharp from 'sharp';
import { createContextualLogger } from '../../../core/logger/logger.js';
import { visionConfig } from '../../../config/vision.config.js';

const logger = createContextualLogger({ module: 'ImageParser' });

export interface ImageMetadata {
    width: number;
    height: number;
    format: string;
    size: number;
}

/**
 * Optimize image for vision model processing
 */
export async function optimizeImage(buffer: Buffer): Promise<Buffer> {
    try {
        const { maxWidth, maxHeight, quality } = visionConfig.image;

        const optimized = await sharp(buffer)
            .resize(maxWidth, maxHeight, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality })
            .toBuffer();

        logger.debug(`Image optimized: ${buffer.length} -> ${optimized.length} bytes`);
        return optimized;
    } catch (error: any) {
        logger.error(`Image optimization failed: ${error.message}`);
        throw new Error(`Failed to optimize image: ${error.message}`);
    }
}

/**
 * Extract image metadata
 */
export async function extractImageMetadata(buffer: Buffer): Promise<ImageMetadata> {
    try {
        const metadata = await sharp(buffer).metadata();

        return {
            width: metadata.width || 0,
            height: metadata.height || 0,
            format: metadata.format || 'unknown',
            size: buffer.length
        };
    } catch (error: any) {
        logger.error(`Failed to extract image metadata: ${error.message}`);
        throw new Error(`Failed to extract image metadata: ${error.message}`);
    }
}

/**
 * Validate image format
 */
export function isValidImageFormat(mimeType: string): boolean {
    const validTypes = [
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/gif',
        'image/webp'
    ];
    return validTypes.includes(mimeType);
}

/**
 * Convert image to base64 for API transmission
 */
export async function imageToBase64(buffer: Buffer): Promise<string> {
    return buffer.toString('base64');
}
