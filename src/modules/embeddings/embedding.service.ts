import * as ort from 'onnxruntime-node';
import logger from '../../core/logger/logger.js';

/**
 * Embedding Service using ONNX Runtime
 * Stage 5 Task 5.2 & 5.7: Cross-platform embedding generation
 */
export class EmbeddingService {
    private session: ort.InferenceSession | null = null;
    private modelPath = './models/all-MiniLM-L6-v2.onnx';
    private maxLength = 128;

    async init(): Promise<void> {
        try {
            logger.info('Loading ONNX embedding model', {
                context: 'EmbeddingService',
                modelPath: this.modelPath
            });

            this.session = await ort.InferenceSession.create(this.modelPath);

            logger.info('ONNX embedding model loaded successfully', {
                context: 'EmbeddingService'
            });
        } catch (error) {
            logger.error('Failed to load ONNX model', error);
            throw new Error('Embedding model initialization failed');
        }
    }

    async generateEmbedding(text: string): Promise<number[]> {
        if (!this.session) {
            throw new Error('Embedding service not initialized');
        }

        try {
            // Simple tokenization (in production, use proper tokenizer)
            const tokens = this.tokenize(text);

            // Create input tensor
            const inputIds = new ort.Tensor('int64', BigInt64Array.from(tokens.map(t => BigInt(t))), [1, tokens.length]);
            const attentionMask = new ort.Tensor('int64', BigInt64Array.from(tokens.map(() => BigInt(1))), [1, tokens.length]);

            // Run inference
            const feeds = {
                input_ids: inputIds,
                attention_mask: attentionMask
            };

            const results = await this.session.run(feeds);

            // Extract embeddings from output
            const embeddings = results.last_hidden_state || results.embeddings;
            const embeddingData = embeddings.data as Float32Array;

            // Mean pooling
            const pooled = this.meanPooling(embeddingData, tokens.length);

            logger.debug('Generated embedding', {
                context: 'EmbeddingService',
                textLength: text.length,
                embeddingDim: pooled.length
            });

            return pooled;
        } catch (error) {
            logger.error('Embedding generation failed', error);
            throw error;
        }
    }

    async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
        return Promise.all(texts.map(text => this.generateEmbedding(text)));
    }

    private tokenize(text: string): number[] {
        // Simple whitespace tokenization (replace with proper tokenizer in production)
        // For production, use @xenova/transformers or similar
        const words = text.toLowerCase().split(/\s+/).slice(0, this.maxLength);

        // Simple vocab mapping (placeholder)
        const tokens = words.map((word, idx) => {
            // Hash-based token ID (simplified)
            let hash = 0;
            for (let i = 0; i < word.length; i++) {
                hash = ((hash << 5) - hash) + word.charCodeAt(i);
                hash = hash & hash;
            }
            return Math.abs(hash % 30000) + 100; // Vocab range
        });

        // Pad to max length
        while (tokens.length < this.maxLength) {
            tokens.push(0); // PAD token
        }

        return tokens.slice(0, this.maxLength);
    }

    private meanPooling(embeddings: Float32Array, seqLength: number): number[] {
        const embeddingDim = 384; // all-MiniLM-L6-v2 dimension
        const pooled = new Array(embeddingDim).fill(0);

        for (let i = 0; i < seqLength; i++) {
            for (let j = 0; j < embeddingDim; j++) {
                pooled[j] += embeddings[i * embeddingDim + j];
            }
        }

        // Average
        for (let j = 0; j < embeddingDim; j++) {
            pooled[j] /= seqLength;
        }

        return pooled;
    }

    async dispose(): Promise<void> {
        if (this.session) {
            await this.session.release();
            this.session = null;
            logger.info('ONNX session released', { context: 'EmbeddingService' });
        }
    }
}

// Singleton instance
export const embeddingService = new EmbeddingService();
