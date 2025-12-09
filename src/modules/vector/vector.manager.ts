// src/modules/vector/vector.manager.ts
import { ChromaClient, Collection } from 'chromadb';
import logger from '../../core/logger/logger.js';
import axios from 'axios';
import crypto from 'crypto';
import redisClient from '../../config/redis.config.js';
import { BatchProcessor } from '../../core/batching/batch-processor.js';
import { CircuitBreaker } from '../../core/reliability/circuit-breaker.js';

export class VectorManager {
    private client: ChromaClient | null = null;
    private collection: Collection | null = null;
    private batchProcessor: BatchProcessor<string, number[]>;
    private chromaCircuitBreaker: CircuitBreaker; // Stage 2

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

        // Stage 2: Initialize ChromaDB circuit breaker
        this.chromaCircuitBreaker = new CircuitBreaker('ChromaDB', {
            failureThreshold: 5,
            resetTimeoutMs: 30000,
            requestTimeoutMs: 15000
        });

        // Initialize batch processor: max 32 items, 50ms delay
        this.batchProcessor = new BatchProcessor<string, number[]>(
            this.processEmbeddingBatch.bind(this),
            32,
            50
        );
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

            // Dummy embedding function to avoid "Cannot instantiate... DefaultEmbeddingFunction" error
            // We manually generate embeddings via TEI anyway, so this is just to satisfy Chroma's requirement
            const dummyEmbeddingFunction = {
                generate: async (texts: string[]) => {
                    return texts.map(() => Array(384).fill(0));
                }
            };

            this.collection = await this.client.getOrCreateCollection({
                name: this.COLLECTION_NAME,
                embeddingFunction: dummyEmbeddingFunction,
                metadata: {
                    'hnsw:space': 'cosine',
                    'hnsw:construction_ef': 200, // Higher = better recall
                    'hnsw:M': 16 // Higher = better recall but more memory
                }
            });
            logger.info(`ChromaDB collection '${this.COLLECTION_NAME}' ready.`);
        } catch (error: any) {
            logger.error(`Failed to connect or initialize ChromaDB: ${error.message}`);
            this.client = null;
            this.collection = null;
        }
    }

    /**
     * Generate embeddings using the external TEI service
     * Uses BatchProcessor to group concurrent requests
     */
    async generateEmbedding(text: string): Promise<number[]> {
        return this.batchProcessor.addToBatch('tei-embedding', text);
    }

    /**
     * Internal method to process a batch of texts for embedding
     */
    private async processEmbeddingBatch(texts: string[]): Promise<number[][]> {
        try {
            logger.debug(`Generating embeddings for batch of ${texts.length} texts`);
            const response = await axios.post(`${this.TEI_URL}/embed`, {
                inputs: texts,
                normalize: true,
                truncate: true
            }, {
                timeout: 5000 // Increased timeout for batch
            });

            // TEI returns array of arrays for batch input
            const embeddings = response.data;
            if (!Array.isArray(embeddings)) {
                throw new Error('Invalid response format from TEI');
            }
            return embeddings;
        } catch (error: any) {
            logger.error(`Error generating batch embeddings via TEI: ${error.message}`);
            // Return zero vectors as fallback
            return texts.map(() => Array(384).fill(0));
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
            // Stage 2: Wrap with circuit breaker
            return await this.chromaCircuitBreaker.execute(async () => {
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

                // Add timeout to vector search
                const searchPromise = this.collection!.query({
                    queryEmbeddings: [queryEmbedding],
                    nResults: topK,
                    where: { userId: userId },
                });

                const timeoutPromise = new Promise<any>((_, reject) =>
                    setTimeout(() => reject(new Error('Vector search timed out')), 2000)
                );

                const results = await Promise.race([searchPromise, timeoutPromise]);

                let documents: string[] = [];
                if (results.documents && results.documents.length > 0 && results.documents[0]) {
                    documents = results.documents[0] as string[];
                    logger.debug(`Retrieved ${documents.length} relevant embeddings for query "${query}"`);
                }

                // Cache results for 1 hour (3600 seconds)
                await redisClient.setex(cacheKey, 3600, JSON.stringify(documents));
                logger.debug(`Cached vector search results for query "${query.substring(0, 50)}..."`);

                return documents;
            });
        } catch (error: any) {
            logger.error(`Error retrieving embeddings: ${error.message}`);
            // Graceful degradation: return empty results
            return [];
        }
    }

    /**
     * Rich semantic search returning detailed results
     */
    async search(query: string, limit: number, filters: Record<string, any> = {}): Promise<Array<{ id: string; document: string; distance: number; metadata: any }>> {
        if (!this.collection) {
            logger.warn('ChromaDB not initialized. Cannot search.');
            return [];
        }

        try {
            return await this.chromaCircuitBreaker.execute(async () => {
                const queryEmbedding = await this.generateEmbedding(query);

                const where = Object.keys(filters).length > 0 ? filters : undefined;

                const results = await this.collection!.query({
                    queryEmbeddings: [queryEmbedding],
                    nResults: limit,
                    where: where,
                });

                const output: Array<{ id: string; document: string; distance: number; metadata: any }> = [];

                if (results.ids && results.ids.length > 0 && results.ids[0]) {
                    const ids = results.ids[0];
                    const documents = results.documents?.[0] || [];
                    const distances = results.distances?.[0] || [];
                    const metadatas = results.metadatas?.[0] || [];

                    for (let i = 0; i < ids.length; i++) {
                        output.push({
                            id: ids[i],
                            document: documents[i] || '',
                            distance: distances[i] || 0,
                            metadata: metadatas[i] || {}
                        });
                    }
                }

                return output;
            });
        } catch (error: any) {
            logger.error(`Error in vector search: ${error.message}`);
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
