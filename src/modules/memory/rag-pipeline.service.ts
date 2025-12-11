import { embeddingService } from '../embeddings/embedding.service.js';
import logger from '../../core/logger/logger.js';

/**
 * RAG Pipeline Service
 * Stage 5 Task 5.2: Advanced RAG with reranking
 */
export class RAGPipelineService {
    async retrieve(query: string, userId: string, k: number = 5): Promise<any[]> {
        try {
            logger.debug('RAG retrieval started', {
                context: 'RAGPipelineService',
                query,
                userId,
                k
            });

            // Step 1: Generate query embedding
            const queryEmbedding = await embeddingService.generateEmbedding(query);

            // Step 2: Vector search (placeholder - integrate with ChromaDB)
            const vectorResults = await this.vectorSearch(queryEmbedding, userId, k * 2);

            // Step 3: Rerank results
            const reranked = await this.rerank(query, vectorResults);

            // Step 4: Deduplicate
            const deduplicated = this.deduplicate(reranked);

            // Step 5: Return top K
            const topK = deduplicated.slice(0, k);

            logger.info('RAG retrieval completed', {
                context: 'RAGPipelineService',
                resultsCount: topK.length
            });

            return topK;
        } catch (error) {
            logger.error('RAG retrieval failed', error);
            throw error;
        }
    }

    private async vectorSearch(embedding: number[], userId: string, limit: number): Promise<any[]> {
        try {
            const { chromaDBService } = await import('../vector/chromadb.service.js');

            if (!chromaDBService.isInitialized()) {
                logger.warn('ChromaDB not initialized', {
                    context: 'RAGPipelineService'
                });
                return [];
            }

            const results = await chromaDBService.query({
                queryEmbeddings: [embedding],
                nResults: limit,
                where: { userId }
            });

            // Transform results
            return results.ids[0].map((id: string, idx: number) => ({
                id,
                document: results.documents[0][idx],
                content: results.documents[0][idx],
                metadata: results.metadatas[0][idx],
                distance: results.distances[0][idx]
            }));
        } catch (error) {
            logger.error('Vector search failed in RAG', error);
            return [];
        }
    }

    private async rerank(query: string, results: any[]): Promise<any[]> {
        if (results.length === 0) return results;

        try {
            // Compute relevance scores
            const scored = await Promise.all(
                results.map(async (result) => {
                    const score = await this.computeRelevance(query, result.document || result.content);
                    return {
                        ...result,
                        rerankScore: score
                    };
                })
            );

            // Sort by rerank score
            scored.sort((a, b) => b.rerankScore - a.rerankScore);

            logger.debug('Reranking completed', {
                context: 'RAGPipelineService',
                resultsCount: scored.length
            });

            return scored;
        } catch (error) {
            logger.error('Reranking failed', error);
            return results; // Fallback to original order
        }
    }

    private async computeRelevance(query: string, document: string): Promise<number> {
        try {
            // Generate embeddings for both
            const [queryEmb, docEmb] = await Promise.all([
                embeddingService.generateEmbedding(query),
                embeddingService.generateEmbedding(document)
            ]);

            // Compute cosine similarity
            const similarity = this.cosineSimilarity(queryEmb, docEmb);
            return similarity;
        } catch (error) {
            logger.error('Relevance computation failed', error);
            return 0;
        }
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        const denominator = Math.sqrt(normA) * Math.sqrt(normB);
        return denominator === 0 ? 0 : dotProduct / denominator;
    }

    private deduplicate(results: any[]): any[] {
        const seen = new Set<string>();
        const deduped: any[] = [];

        for (const result of results) {
            const key = result.id || result.document || result.content;
            if (!seen.has(key)) {
                seen.add(key);
                deduped.push(result);
            }
        }

        logger.debug('Deduplication completed', {
            context: 'RAGPipelineService',
            original: results.length,
            deduplicated: deduped.length
        });

        return deduped;
    }
}

export const ragPipelineService = new RAGPipelineService();
