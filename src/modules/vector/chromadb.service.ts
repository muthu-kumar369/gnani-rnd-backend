import { ChromaClient } from 'chromadb';
import logger from '../../core/logger/logger.js';
import config from '../../config/app.config.js';

/**
 * ChromaDB Client Configuration
 * Stage 5: Vector database for semantic search
 */
class ChromaDBService {
    private client: ChromaClient | null = null;
    private collectionName = 'gnani_embeddings';
    private collection: any = null;

    async init(): Promise<void> {
        try {
            logger.info('Initializing ChromaDB client', {
                context: 'ChromaDBService'
            });

            // STAGE 1: Use centralized config
            this.client = new ChromaClient({
                path: `http://${config.CHROMA_HOST}:${config.CHROMA_PORT}`
            });

            // Get or create collection
            try {
                this.collection = await this.client.getCollection({
                    name: this.collectionName
                });
                logger.info('ChromaDB collection found', {
                    context: 'ChromaDBService',
                    collection: this.collectionName
                });
            } catch (error) {
                // Collection doesn't exist, create it
                this.collection = await this.client.createCollection({
                    name: this.collectionName,
                    metadata: { description: 'Gnani embeddings for semantic search' }
                });
                logger.info('ChromaDB collection created', {
                    context: 'ChromaDBService',
                    collection: this.collectionName
                });
            }
        } catch (error) {
            logger.error('ChromaDB initialization failed', error);
            throw error;
        }
    }

    async add(params: {
        ids: string[];
        embeddings: number[][];
        metadatas: any[];
        documents: string[];
    }): Promise<void> {
        if (!this.collection) {
            throw new Error('ChromaDB not initialized');
        }

        try {
            await this.collection.add({
                ids: params.ids,
                embeddings: params.embeddings,
                metadatas: params.metadatas,
                documents: params.documents
            });

            logger.debug('Documents added to ChromaDB', {
                context: 'ChromaDBService',
                count: params.ids.length
            });
        } catch (error) {
            logger.error('Failed to add documents to ChromaDB', error);
            throw error;
        }
    }

    async query(params: {
        queryEmbeddings: number[][];
        nResults: number;
        where?: any;
    }): Promise<any> {
        if (!this.collection) {
            throw new Error('ChromaDB not initialized');
        }

        try {
            const results = await this.collection.query({
                queryEmbeddings: params.queryEmbeddings,
                nResults: params.nResults,
                where: params.where
            });

            logger.debug('ChromaDB query executed', {
                context: 'ChromaDBService',
                resultsCount: results.ids[0]?.length || 0
            });

            return results;
        } catch (error) {
            logger.error('ChromaDB query failed', error);
            throw error;
        }
    }

    async delete(params: { ids: string[] }): Promise<void> {
        if (!this.collection) {
            throw new Error('ChromaDB not initialized');
        }

        try {
            await this.collection.delete({
                ids: params.ids
            });

            logger.debug('Documents deleted from ChromaDB', {
                context: 'ChromaDBService',
                count: params.ids.length
            });
        } catch (error) {
            logger.error('Failed to delete from ChromaDB', error);
            throw error;
        }
    }

    async count(): Promise<number> {
        if (!this.collection) {
            throw new Error('ChromaDB not initialized');
        }

        try {
            const count = await this.collection.count();
            return count;
        } catch (error) {
            logger.error('Failed to get ChromaDB count', error);
            return 0;
        }
    }

    isInitialized(): boolean {
        return this.collection !== null;
    }
}

export const chromaDBService = new ChromaDBService();
