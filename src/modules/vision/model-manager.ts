// src/modules/vision/model-manager.ts
import axios from 'axios';
import { createContextualLogger } from '../../core/logger/logger.js';
import { visionConfig } from '../../config/vision.config.js';
import { Logger } from 'winston';

class VisionModelManager {
    private logger: Logger;
    private modelLoaded: boolean = false;
    private endpoint: string;
    private modelName: string;

    constructor() {
        this.logger = createContextualLogger({ module: 'VisionModelManager' });
        this.endpoint = visionConfig.endpoint;
        this.modelName = visionConfig.modelName;
    }

    /**
     * Check if Ollama is available and model is loaded
     */
    async checkModelAvailability(): Promise<boolean> {
        try {
            const response = await axios.get(`${this.endpoint}/api/tags`, {
                timeout: 5000
            });

            const models = response.data.models || [];
            const modelExists = models.some((m: any) => m.name === this.modelName);

            if (modelExists) {
                this.modelLoaded = true;
                this.logger.info(`Vision model ${this.modelName} is available`);
            } else {
                this.logger.warn(`Vision model ${this.modelName} not found in Ollama`);
            }

            return modelExists;
        } catch (error: any) {
            this.logger.error(`Failed to check model availability: ${error.message}`);
            return false;
        }
    }

    /**
     * Analyze image using vision model
     */
    async analyzeImage(imageBase64: string, prompt?: string): Promise<string> {
        if (!this.modelLoaded) {
            const available = await this.checkModelAvailability();
            if (!available) {
                throw new Error('Vision model is not available. Please run setup-vision-model.sh');
            }
        }

        try {
            const analysisPrompt = prompt || 'Describe this image in detail, including objects, people, actions, colors, and any text visible.';

            this.logger.info('Sending image to vision model for analysis...');

            const response = await axios.post(
                `${this.endpoint}/api/generate`,
                {
                    model: this.modelName,
                    prompt: analysisPrompt,
                    images: [imageBase64],
                    stream: false
                },
                {
                    timeout: visionConfig.timeout.analysis
                }
            );

            const analysis = response.data.response || '';
            this.logger.info(`Vision analysis completed: ${analysis.substring(0, 100)}...`);

            return analysis;
        } catch (error: any) {
            this.logger.error(`Vision analysis failed: ${error.message}`);
            throw new Error(`Failed to analyze image: ${error.message}`);
        }
    }

    /**
     * Analyze multiple images
     */
    async analyzeMultipleImages(imagesBase64: string[], prompt?: string): Promise<string[]> {
        const analyses: string[] = [];

        for (let i = 0; i < imagesBase64.length; i++) {
            try {
                const imagePrompt = prompt || `Describe image ${i + 1} in detail.`;
                const analysis = await this.analyzeImage(imagesBase64[i], imagePrompt);
                analyses.push(analysis);
            } catch (error: any) {
                this.logger.error(`Failed to analyze image ${i + 1}: ${error.message}`);
                analyses.push(`[Analysis failed for image ${i + 1}]`);
            }
        }

        return analyses;
    }

    /**
     * Check if vision model is ready
     */
    isModelReady(): boolean {
        return this.modelLoaded;
    }
}

export default new VisionModelManager();
