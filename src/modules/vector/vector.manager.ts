// src/services/vectorManager.ts
import { ChromaClient, Collection } from 'chromadb';
import logger from '../../core/logger/logger.js';
// Removed unused imports from config, assuming ChromaDB connection details are directly passed or handled internally
// const { VECTOR_DB_HOST, VECTOR_DB_PORT, COLLECTION_NAME, API_KEY } = require('../configs/config');

// Placeholder for an embedding function. In a real scenario, this would use an actual embedding model.
async function getDummyEmbedding(text: string): Promise<number[]> {
    logger.debug(`Generating dummy embedding for text: "${text}"`);
    const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Array(1536).fill(hash % 1000 / 1000); // Return a fixed-size array for simulation
}

class VectorManager {
    private client: ChromaClient | null = null;
    private collection: Collection | null = null;
    private VECTOR_DB_HOST: string = process.env.VECTOR_DB_HOST || 'localhost';
    private VECTOR_DB_PORT: string = process.env.VECTOR_DB_PORT || '8000';
    private COLLECTION_NAME: string = process.env.COLLECTION_NAME || 'gnani_collection';

    constructor() {
        this.initializeChromaDB();
        logger.info('VectorManager initialized.');
    }

    async initializeChromaDB(): Promise<void> {
        try {
            const chromaDbUrl = `http://${this.VECTOR_DB_HOST}:${this.VECTOR_DB_PORT}`;
            this.client = new ChromaClient({ path: chromaDbUrl });
            
            await this.client.heartbeat();
            logger.info(`ChromaDB client connected to ${chromaDbUrl}`);

            this.collection = await this.client.getOrCreateCollection({ name: this.COLLECTION_NAME });
            logger.info(`ChromaDB collection '${this.COLLECTION_NAME}' ready.`);
        } catch (error: any) {
            logger.error(`Failed to connect or initialize ChromaDB: ${error.message}`);
            this.client = null;
            this.collection = null;
        }
    }

    async getRelevantEmbeddings(userId: string, query: string, topK = 3): Promise<string[]> {
        if (!this.collection) {
            logger.warn('ChromaDB not initialized. Cannot retrieve embeddings. Returning empty array.');
            return [];
        }

        try {
            const queryEmbedding = await getDummyEmbedding(query);

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
            const embedding = await getDummyEmbedding(documentContent);
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
