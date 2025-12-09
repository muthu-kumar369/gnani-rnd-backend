import natural from 'natural';
import { createContextualLogger } from '../../core/logger/logger.js';

const TfIdf = natural.TfIdf;

export interface SearchDocument {
    id: string;
    content: string;
    metadata?: Record<string, any>;
}

export class BM25SearchService {
    private readonly logger = createContextualLogger({ module: 'BM25Search' });
    private tfidf: any;
    private documents: Map<string, SearchDocument> = new Map();

    constructor() {
        this.tfidf = new TfIdf();
    }

    /**
     * Index documents for BM25 search
     */
    indexDocuments(documents: SearchDocument[]): void {
        this.documents.clear();
        this.tfidf = new TfIdf();

        for (const doc of documents) {
            this.documents.set(doc.id, doc);
            this.tfidf.addDocument(doc.content);
        }

        this.logger.info(`Indexed ${documents.length} documents for BM25 search`);
    }

    /**
     * Search using BM25 algorithm
     */
    search(query: string, limit: number = 10): Array<{
        id: string;
        score: number;
        document: SearchDocument;
    }> {
        const results: Array<{ id: string; score: number; document: SearchDocument }> = [];

        this.tfidf.tfidfs(query, (i: number, measure: number) => {
            const docArray = Array.from(this.documents.values());
            if (i < docArray.length) {
                results.push({
                    id: docArray[i].id,
                    score: measure,
                    document: docArray[i],
                });
            }
        });

        // Sort by score descending and limit
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }
}
