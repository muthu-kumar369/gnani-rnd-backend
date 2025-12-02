// src/modules/vector/vector.manager.ts
import { ChromaClient, Collection } from 'chromadb';
import logger from '../../core/logger/logger.js';
import axios from 'axios';
import crypto from 'crypto';
import redisClient from '../../config/redis.config.js';

class VectorManager {
    private client: ChromaClient | null = null;
    private collection: Collection | null = null;
    
    // Configuration
    private VECTOR_DB_HOST: string = process.env.VECTOR_DB_HOST || 'localhost';
    private VECTOR_DB_PORT: string = process.env.VECTOR_DB_PORT || '8000';
    private COLLECTION_NAME: string = process.env.COLLECTION_NAME || 'gnani_collection';
    
    // TEI Configuration
    private TEI_HOST: string = process.env.TEI_HOST || 'localhost';
    private TEI_PORT: string = process.env.TEI_PORT || '8080';
    private TEI_URL: string;

    constructor() {
        this.TEI_URL = `http://${this.TEI_HOST}:${this.TEI_PORT}`;
        this.initialize();
    }

    private async initialize() {
        await this.initializeChromaDB();
        this.checkTEIConnection();
    }

    private async checkTEIConnection(retries = 5, delay = 2000) {
        for (let i = 0; i < retries; i++) {
            try {
                // TEI exposes a /health or /info endpoint, but we can just try a dummy embed
                await axios.get(`${this.TEI_URL}/health`, { timeout: 2000 });
                logger.info(`Connected to TEI Service at ${this.TEI_URL}`);
                return;
            } catch (error: any) {
                logger.warn(`Attempt ${i + 1}/${retries}: Failed to connect to TEI Service at ${this.TEI_URL}. Is Docker running? Error: ${error.message}`);
                if (i < retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        logger.error(`Could not connect to TEI Service after ${retries} attempts.`);
    }

    async initializeChromaDB(): Promise<void> {
        try {
            const chromaDbUrl = `http://${this.VECTOR_DB_HOST}:${this.VECTOR_DB_PORT}`;
            this.client = new ChromaClient({ path: chromaDbUrl });

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
     * Generate embeddings using the external TEI service
     */
    async generateEmbedding(text: string): Promise<number[]> {
        try {
            const response = await axios.post(`${this.TEI_URL}/embed`, {
                inputs: text,
                normalize: true,
                truncate: true
            });
            
            // TEI returns an array of arrays for batch, or single array? 
            // Usually [ [0.1, ...] ] for inputs: "string" or ["string"]
            // We will assume inputs is treated as a batch of 1.
            
            const embedding = response.data[0]; 
            return embedding;
        } catch (error: any) {
            logger.error(`Error generating embedding via TEI: ${error.message}`);
            // Return zero vector as fallback to prevent crash
            return Array(384).fill(0); 
        }
    }

    /**
     * Generate cache key for query
     */
    private getCacheKey(userId: string, query: string, topK: number): string {
        const hash = crypto.createHash('md5').update(`${userId}:${query}:${topK}`).digest('hex');
        return `vector:cache:${hash}`;
    }

    async getRelevantEmbeddings(userId: string, query: string, topK = 3): Promise<string[]> {
        if (!this.collection) {
            logger.warn('ChromaDB not initialized. Cannot retrieve embeddings.');
            return [];
        }

        try {
            // Check cache first
            const cacheKey = this.getCacheKey(userId, query, topK);
            const cachedResults = await redisClient.get(cacheKey);
            
            if (cachedResults) {
                const results = JSON.parse(cachedResults);
                logger.debug(`Vector search - Cache HIT for query "${query.substring(0, 50)}..."`);
                return results;
            }

            logger.debug(`Vector search - Cache MISS for query "${query.substring(0, 50)}..."`);

            // Cache miss - generate embedding and search
            const queryEmbedding = await this.generateEmbedding(query);

            const results = await this.collection.query({
                queryEmbeddings: [queryEmbedding],
                nResults: topK,
                where: { userId: userId },
            });

            let documents: string[] = [];
            if (results.documents && results.documents.length > 0 && results.documents[0]) {
                documents = results.documents[0] as string[];
                logger.debug(`Retrieved ${documents.length} relevant embeddings for query "${query}"`);
            }

            // Cache results for 1 hour (3600 seconds)
            await redisClient.setex(cacheKey, 3600, JSON.stringify(documents));
            logger.debug(`Cached vector search results for query "${query.substring(0, 50)}..."`);

            return documents;
        } catch (error: any) {
            logger.error(`Error retrieving embeddings: ${error.message}`);
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
            logger.error(`Error adding embedding: ${error.message}`);
        }
    }
}

export default new VectorManager();
