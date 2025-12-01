// src/services/vectorManager.ts
import { ChromaClient, Collection } from 'chromadb';
import logger from '../../core/logger/logger.js';
import { pipeline, env } from '@xenova/transformers';
import path from 'path';
import fs from 'fs';

// Configure local cache for models
const modelPath = path.join(process.cwd(), 'models');
if (!fs.existsSync(modelPath)) {
    fs.mkdirSync(modelPath, { recursive: true });
}

env.localModelPath = modelPath;
env.allowRemoteModels = true; // Allow downloading if not present
env.allowLocalModels = true;

class VectorManager {
    private client: ChromaClient | null = null;
    private collection: Collection | null = null;
    private embeddingPipeline: any = null;
    private VECTOR_DB_HOST: string = process.env.VECTOR_DB_HOST || 'localhost';
    private VECTOR_DB_PORT: string = process.env.VECTOR_DB_PORT || '8000';
    private COLLECTION_NAME: string = process.env.COLLECTION_NAME || 'gnani_collection';

    constructor() {
        this.initialize();
    }

    private async initialize() {
        await this.initializeChromaDB();
        // Initialize embedding model in background to not block startup completely
        this.initializeEmbeddingModel().catch(err => {
            logger.error(`Background embedding model initialization failed: ${err.message}`);
        });
    }

    private async initializeEmbeddingModel() {
        try {
            logger.info('Initializing embedding model (Xenova/all-MiniLM-L6-v2)...');
            // Use feature-extraction task
            this.embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
            logger.info('Embedding model loaded successfully.');
        } catch (error: any) {
            logger.error(`Failed to load embedding model: ${error.message}`);
            this.embeddingPipeline = null;
        }
    }

    async initializeChromaDB(): Promise<void> {
        try {
            const chromaDbUrl = `http://${this.VECTOR_DB_HOST}:${this.VECTOR_DB_PORT}`;
            this.client = new ChromaClient({ path: chromaDbUrl });

            // Heartbeat might fail if Chroma isn't running, but we shouldn't crash
            try {
                await this.client.heartbeat();
                logger.info(`ChromaDB client connected to ${chromaDbUrl}`);
            } catch (e) {
                logger.warn(`ChromaDB heartbeat failed at ${chromaDbUrl}. Is the service running?`);
            }

            this.collection = await this.client.getOrCreateCollection({ name: this.COLLECTION_NAME });
            logger.info(`ChromaDB collection '${this.COLLECTION_NAME}' ready.`);
        } catch (error: any) {
            logger.error(`Failed to connect or initialize ChromaDB: ${error.message}`);
            this.client = null;
            this.collection = null;
        }
    }

    /**
     * Generate embeddings using the local model
     */
    async generateEmbedding(text: string): Promise<number[]> {
        if (!this.embeddingPipeline) {
            logger.warn('Embedding pipeline not initialized. Waiting 1s...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (!this.embeddingPipeline) {
                logger.error('Embedding pipeline still not ready. Returning zero vector.');
                return Array(384).fill(0); // all-MiniLM-L6-v2 dimension is 384
            }
        }

        try {
            // pooling: 'mean', normalize: true are standard for sentence embeddings
            const output = await this.embeddingPipeline(text, { pooling: 'mean', normalize: true });
            return Array.from(output.data);
        } catch (error: any) {
            logger.error(`Error generating embedding: ${error.message}`);
            return Array(384).fill(0);
        }
    }

    async getRelevantEmbeddings(userId: string, query: string, topK = 3): Promise<string[]> {
        if (!this.collection) {
            logger.warn('ChromaDB not initialized. Cannot retrieve embeddings. Returning empty array.');
            return [];
        }

        try {
            const queryEmbedding = await this.generateEmbedding(query);

            const results = await this.collection.query({
                queryEmbeddings: [queryEmbedding],
                nResults: topK,
                where: { userId: userId },
            });

            if (results.documents && results.documents.length > 0 && results.documents[0]) {
                logger.debug(`Retrieved ${results.documents[0].length} relevant embeddings for query "${query}"`);
                return results.documents[0] as string[];
            }
            logger.debug(`No relevant embeddings found for query "${query}"`);
            return [];
        } catch (error: any) {
            logger.error(`Error retrieving embeddings from ChromaDB for user ${userId}, query "${query}": ${error.message}`);
            return [];
        }
    }

    async addEmbedding(userId: string, documentId: string, documentContent: string, metadata: object = {}): Promise<void> {
        if (!this.collection) {
            logger.warn('ChromaDB not initialized. Cannot add embedding.');
            return;
        }

        try {
            const embedding = await this.generateEmbedding(documentContent);
            await this.collection.add({
                embeddings: [embedding],
                metadatas: [{ userId: userId, ...metadata }],
                documents: [documentContent],
                ids: [documentId]
            });
            logger.debug(`Embedding added for user ${userId}, documentId ${documentId}`);
        } catch (error: any) {
            logger.error(`Error adding embedding to ChromaDB for user ${userId}, documentId ${documentId}: ${error.message}`);
        }
    }
}

export default new VectorManager();
