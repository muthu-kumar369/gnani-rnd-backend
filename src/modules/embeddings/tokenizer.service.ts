import { pipeline } from '@xenova/transformers';
import logger from '../../core/logger/logger.js';

/**
 * Tokenizer Service using Transformers.js
 * Stage 5: Proper tokenization for embeddings
 */
class TokenizerService {
    private tokenizer: any = null;
    private modelName = 'Xenova/all-MiniLM-L6-v2';

    async init(): Promise<void> {
        try {
            logger.info('Loading tokenizer', {
                context: 'TokenizerService',
                model: this.modelName
            });

            this.tokenizer = await pipeline('feature-extraction', this.modelName);

            logger.info('Tokenizer loaded successfully', {
                context: 'TokenizerService'
            });
        } catch (error) {
            logger.error('Tokenizer initialization failed', error);
            throw error;
        }
    }

    async tokenize(text: string): Promise<number[]> {
        if (!this.tokenizer) {
            throw new Error('Tokenizer not initialized');
        }

        try {
            const output = await this.tokenizer(text, {
                pooling: 'mean',
                normalize: true
            });

            // Convert to array
            const embedding = Array.from(output.data);

            logger.debug('Text tokenized', {
                context: 'TokenizerService',
                textLength: text.length,
                embeddingDim: embedding.length
            });

            return embedding as number[];
        } catch (error) {
            logger.error('Tokenization failed', error);
            throw error;
        }
    }

    async tokenizeBatch(texts: string[]): Promise<number[][]> {
        return Promise.all(texts.map(text => this.tokenize(text)));
    }

    isInitialized(): boolean {
        return this.tokenizer !== null;
    }
}

export const tokenizerService = new TokenizerService();
