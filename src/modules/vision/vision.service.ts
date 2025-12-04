// src/modules/vision/vision.service.ts
import visionModelManager from './model-manager.js';
import { optimizeImage, extractImageMetadata, imageToBase64 } from '../file/parsers/image.parser.js';
import { createContextualLogger } from '../../core/logger/logger.js';
import { visionConfig } from '../../config/vision.config.js';
import { Logger } from 'winston';
import crypto from 'crypto';

export interface VisionAnalysis {
    analysis: string;
    metadata: {
        width: number;
        height: number;
        format: string;
        size: number;
    };
    cacheKey?: string;
}

class VisionService {
    private logger: Logger;
    private analysisCache: Map<string, { analysis: string; timestamp: number }>;

    constructor() {
        this.logger = createContextualLogger({ module: 'VisionService' });
        this.analysisCache = new Map();

        // Clean cache periodically
        if (visionConfig.cache.enabled) {
            setInterval(() => this.cleanCache(), 60000); // Every minute
        }
    }

    /**
     * Process and analyze image
     */
    async processImage(imageBuffer: Buffer, prompt?: string): Promise<VisionAnalysis> {
        try {
            // Extract metadata before optimization
            const metadata = await extractImageMetadata(imageBuffer);
            this.logger.info(`Processing image: ${metadata.width}x${metadata.height}, ${metadata.format}`);

            // Check cache
            const cacheKey = this.generateCacheKey(imageBuffer);
            if (visionConfig.cache.enabled) {
                const cached = this.getFromCache(cacheKey);
                if (cached) {
                    this.logger.info('Returning cached vision analysis');
                    return {
                        analysis: cached,
                        metadata,
                        cacheKey
                    };
                }
            }

            // Optimize image
            const optimizedBuffer = await optimizeImage(imageBuffer);

            // Convert to base64
            const imageBase64 = await imageToBase64(optimizedBuffer);

            // Analyze with vision model
            const analysis = await visionModelManager.analyzeImage(imageBase64, prompt);

            // Cache result
            if (visionConfig.cache.enabled) {
                this.saveToCache(cacheKey, analysis);
            }

            return {
                analysis,
                metadata,
                cacheKey
            };
        } catch (error: any) {
            this.logger.error(`Failed to process image: ${error.message}`);
            throw error;
        }
    }

    /**
     * Process multiple images
     */
    async processMultipleImages(imageBuffers: Buffer[], prompt?: string): Promise<VisionAnalysis[]> {
        const results: VisionAnalysis[] = [];

        for (let i = 0; i < imageBuffers.length; i++) {
            try {
                const imagePrompt = prompt || `Describe image ${i + 1}`;
                const result = await this.processImage(imageBuffers[i], imagePrompt);
                results.push(result);
            } catch (error: any) {
                this.logger.error(`Failed to process image ${i + 1}: ${error.message}`);
                // Add placeholder for failed analysis
                results.push({
                    analysis: '[Image analysis failed]',
                    metadata: { width: 0, height: 0, format: 'unknown', size: 0 }
                });
            }
        }

        return results;
    }

    /**
     * Generate cache key from image buffer
     */
    private generateCacheKey(buffer: Buffer): string {
        return crypto.createHash('md5').update(buffer).digest('hex');
    }

    /**
     * Get analysis from cache
     */
    private getFromCache(key: string): string | null {
        const cached = this.analysisCache.get(key);
        if (!cached) return null;

        const age = Date.now() - cached.timestamp;
        if (age > visionConfig.cache.ttl * 1000) {
            this.analysisCache.delete(key);
            return null;
        }

        return cached.analysis;
    }

    /**
     * Save analysis to cache
     */
    private saveToCache(key: string, analysis: string): void {
        this.analysisCache.set(key, {
            analysis,
            timestamp: Date.now()
        });
    }

    /**
     * Clean expired cache entries
     */
    private cleanCache(): void {
        const now = Date.now();
        const ttl = visionConfig.cache.ttl * 1000;

        for (const [key, value] of this.analysisCache.entries()) {
            if (now - value.timestamp > ttl) {
                this.analysisCache.delete(key);
            }
        }
    }

    /**
     * Check if vision service is available
     */
    async isAvailable(): Promise<boolean> {
        if (!visionConfig.enabled) {
            return false;
        }
        return await visionModelManager.checkModelAvailability();
    }
}

export default new VisionService();
