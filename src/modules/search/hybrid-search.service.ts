import vectorManager, { VectorManager } from '../vector/vector.manager.js';
import logger from '../../core/logger/logger.js';

interface SearchResult {
    id: string;
    content: string;
    score: number;
    metadata: any;
}

export class HybridSearchService {

    constructor(private readonly vectorManager: VectorManager) { }

    /**
     * Hybrid search combining semantic and keyword search
     */
    async search(
        query: string,
        options: {
            limit?: number;
            semanticWeight?: number;  // 0-1, weight for semantic search
            keywordWeight?: number;   // 0-1, weight for keyword search
            filters?: Record<string, any>;
        } = {}
    ): Promise<SearchResult[]> {
        const {
            limit = 10,
            semanticWeight = 0.7,
            keywordWeight = 0.3,
            filters = {},
        } = options;

        logger.debug(`Starting hybrid search for: "${query}"`);

        // Perform both searches in parallel
        const [semanticResults, keywordResults] = await Promise.all([
            this.semanticSearch(query, limit * 2, filters),
            this.keywordSearch(query, limit * 2, filters),
        ]);

        // Combine and re-rank results
        const combined = this.combineResults(
            semanticResults,
            keywordResults,
            semanticWeight,
            keywordWeight
        );

        logger.debug(`Hybrid search finished. Found ${combined.length} results.`);

        // Return top results
        return combined.slice(0, limit);
    }

    /**
     * Semantic search using embeddings
     */
    private async semanticSearch(
        query: string,
        limit: number,
        filters: Record<string, any>
    ): Promise<SearchResult[]> {
        if (!this.vectorManager) return [];

        // Explicitly use the search method we added to VectorManager
        const results = await this.vectorManager.search(query, limit, filters);

        return results.map(r => ({
            id: r.id,
            content: r.document,
            score: 1 - r.distance, // Chroma returns distance (lower is better), we want similarity (higher is better).
            metadata: r.metadata,
        }));
    }

    /**
     * Keyword search using BM25
     */
    private async keywordSearch(
        query: string,
        limit: number,
        filters: Record<string, any>
    ): Promise<SearchResult[]> {
        // Use BM25 search service for better keyword matching
        const { BM25SearchService } = await import('./bm25-search.service.js');
        const bm25 = new BM25SearchService();

        // Get documents (from database or cache)
        const documents = await this.getDocuments(filters);
        if (documents.length === 0) return [];

        // Index documents for BM25
        bm25.indexDocuments(documents.map(doc => ({
            id: doc.id,
            content: doc.content,
            metadata: doc.metadata
        })));

        // Perform BM25 search
        const results = bm25.search(query, limit);

        return results.map(r => ({
            id: r.id,
            content: r.document.content,
            metadata: r.document.metadata,
            score: r.score,
        }));
    }

    /**
     * Combine results from semantic and keyword search
     */
    private combineResults(
        semanticResults: SearchResult[],
        keywordResults: SearchResult[],
        semanticWeight: number,
        keywordWeight: number
    ): SearchResult[] {
        // Create a map of all unique results
        const resultMap = new Map<string, SearchResult>();

        // Add semantic results
        for (const result of semanticResults) {
            const weightedScore = result.score * semanticWeight;
            resultMap.set(result.id, {
                ...result,
                score: weightedScore,
            });
        }

        // Add/merge keyword results
        for (const result of keywordResults) {
            if (resultMap.has(result.id)) {
                // Combine scores
                const existing = resultMap.get(result.id)!;
                existing.score += result.score * keywordWeight;
            } else {
                resultMap.set(result.id, {
                    ...result,
                    score: result.score * keywordWeight,
                });
            }
        }

        // Convert to array and sort by combined score
        return Array.from(resultMap.values())
            .sort((a, b) => b.score - a.score);
    }

    /**
     * Tokenize text for keyword search
     */
    private tokenize(text: string): string[] {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(token => token.length > 2);
    }

    /**
     * Calculate BM25 score
     */
    private calculateBM25(
        queryTokens: string[],
        document: string,
        corpus: any[],
        k1: number = 1.5,
        b: number = 0.75
    ): number {
        const docTokens = this.tokenize(document);
        const docLength = docTokens.length;
        if (docLength === 0) return 0;

        const totalLength = corpus.reduce((sum, doc) =>
            sum + this.tokenize(doc.content).length, 0);
        const avgDocLength = totalLength / (corpus.length || 1);

        let score = 0;

        for (const token of queryTokens) {
            const termFreq = docTokens.filter(t => t === token).length;
            if (termFreq === 0) continue;

            const docFreq = corpus.filter(doc =>
                this.tokenize(doc.content).includes(token)).length;

            const idf = Math.log((corpus.length - docFreq + 0.5) / (docFreq + 0.5) + 1);

            const tf = (termFreq * (k1 + 1)) /
                (termFreq + k1 * (1 - b + b * (docLength / avgDocLength)));

            score += idf * tf;
        }

        return score;
    }

    private async getDocuments(filters: Record<string, any>): Promise<any[]> {
        // Fetch documents from database
        // This is a placeholder - implement based on your data source
        return [];
    }
}

export default new HybridSearchService(vectorManager);
