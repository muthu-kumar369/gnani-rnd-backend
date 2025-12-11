import { embeddingService } from '../embeddings/embedding.service.js';
import logger from '../../core/logger/logger.js';

/**
 * Semantic Search Service
 * Stage 5 Task 5.7: Semantic search with embeddings
 */
export class SemanticSearchService {
    async search(query: string, userId: string, limit: number = 20): Promise<any[]> {
        try {
            logger.debug('Semantic search started', {
                context: 'SemanticSearchService',
                query,
                userId,
                limit
            });

            // Generate query embedding
            const embedding = await embeddingService.generateEmbedding(query);

            // Search in vector database (ChromaDB)
            const results = await this.vectorSearch(embedding, userId, limit);

            // Enhance with metadata
            const enhanced = await this.enhanceResults(results);

            logger.info('Semantic search completed', {
                context: 'SemanticSearchService',
                resultsCount: enhanced.length
            });

            return enhanced;
        } catch (error) {
            logger.error('Semantic search failed', error);
            throw error;
        }
    }

    async indexDocument(doc: any, userId: string): Promise<void> {
        try {
            const embedding = await embeddingService.generateEmbedding(doc.content);

            // Index in ChromaDB
            await this.addToVectorDB({
                id: doc.id,
                embedding,
                metadata: { userId, ...doc.metadata },
                document: doc.content
            });

            logger.debug('Document indexed', {
                context: 'SemanticSearchService',
                docId: doc.id
            });
        } catch (error) {
            logger.error('Document indexing failed', error);
            throw error;
        }
    }

    async indexBatch(docs: any[], userId: string): Promise<void> {
        try {
            logger.info('Batch indexing started', {
                context: 'SemanticSearchService',
                count: docs.length
            });

            // Generate embeddings in parallel
            const embeddings = await embeddingService.generateBatchEmbeddings(
                docs.map(d => d.content)
            );

            // Batch insert to vector DB
            await this.batchAddToVectorDB(
                docs.map((doc, idx) => ({
                    id: doc.id,
                    embedding: embeddings[idx],
                    metadata: { userId, ...doc.metadata },
                    document: doc.content
                }))
            );

            logger.info('Batch indexing completed', {
                context: 'SemanticSearchService',
                count: docs.length
            });
        } catch (error) {
            logger.error('Batch indexing failed', error);
            throw error;
        }
    }

    private async vectorSearch(embedding: number[], userId: string, limit: number): Promise<any[]> {
        try {
            const { chromaDBService } = await import('../vector/chromadb.service.js');

            if (!chromaDBService.isInitialized()) {
                logger.warn('ChromaDB not initialized, returning empty results', {
                    context: 'SemanticSearchService'
                });
                return [];
            }

            const results = await chromaDBService.query({
                queryEmbeddings: [embedding],
                nResults: limit,
                where: { userId }
            });

            // Transform ChromaDB results
            const transformed = results.ids[0].map((id: string, idx: number) => ({
                id,
                document: results.documents[0][idx],
                metadata: results.metadatas[0][idx],
                distance: results.distances[0][idx],
                score: 1 - results.distances[0][idx] // Convert distance to similarity
            }));

            return transformed;
        } catch (error) {
            logger.error('Vector search failed', error);
            return [];
        }
    }

    private async addToVectorDB(item: any): Promise<void> {
        try {
            const { chromaDBService } = await import('../vector/chromadb.service.js');

            if (!chromaDBService.isInitialized()) {
                throw new Error('ChromaDB not initialized');
            }

            await chromaDBService.add({
                ids: [item.id],
                embeddings: [item.embedding],
                metadatas: [item.metadata],
                documents: [item.document]
            });
        } catch (error) {
            logger.error('Failed to add to vector DB', error);
            throw error;
        }
    }

    private async batchAddToVectorDB(items: any[]): Promise<void> {
        try {
            const { chromaDBService } = await import('../vector/chromadb.service.js');

            if (!chromaDBService.isInitialized()) {
                throw new Error('ChromaDB not initialized');
            }

            await chromaDBService.add({
                ids: items.map(i => i.id),
                embeddings: items.map(i => i.embedding),
                metadatas: items.map(i => i.metadata),
                documents: items.map(i => i.document)
            });
        } catch (error) {
            logger.error('Batch add to vector DB failed', error);
            throw error;
        }
    }

    private async enhanceResults(results: any[]): Promise<any[]> {
        // Add additional metadata, scores, etc.
        return results.map(r => ({
            ...r,
            score: r.distance ? 1 - r.distance : r.score || 0,
            relevance: this.calculateRelevance(r)
        }));
    }

    private calculateRelevance(result: any): 'high' | 'medium' | 'low' {
        const score = result.score || 0;
        if (score > 0.8) return 'high';
        if (score > 0.5) return 'medium';
        return 'low';
    }
}

export const semanticSearchService = new SemanticSearchService();
