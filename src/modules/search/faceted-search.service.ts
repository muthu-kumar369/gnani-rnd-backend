import { semanticSearchService } from './semantic-search.service.js';
import logger from '../../core/logger/logger.js';

interface SearchFilters {
    dateRange?: { start: Date; end: Date };
    folders?: string[];
    hasAttachments?: boolean;
    messageType?: 'user' | 'assistant';
    minLength?: number;
    maxLength?: number;
}

/**
 * Faceted Search Service
 * Stage 5 Task 5.8: Faceted search with filters
 */
export class FacetedSearchService {
    async search(query: string, filters: SearchFilters, userId: string): Promise<any[]> {
        try {
            logger.debug('Faceted search started', {
                context: 'FacetedSearchService',
                query,
                filters
            });

            // Build MongoDB query
            const mongoQuery: any = { userId };

            if (filters.dateRange) {
                mongoQuery.timestamp = {
                    $gte: filters.dateRange.start,
                    $lte: filters.dateRange.end
                };
            }

            if (filters.folders && filters.folders.length > 0) {
                mongoQuery.folderId = { $in: filters.folders };
            }

            if (filters.hasAttachments !== undefined) {
                mongoQuery.hasAttachments = filters.hasAttachments;
            }

            if (filters.messageType) {
                mongoQuery.role = filters.messageType;
            }

            if (filters.minLength) {
                mongoQuery.$expr = { $gte: [{ $strLenCP: '$content' }, filters.minLength] };
            }

            if (filters.maxLength) {
                mongoQuery.$expr = {
                    ...mongoQuery.$expr,
                    $lte: [{ $strLenCP: '$content' }, filters.maxLength]
                };
            }

            // Combine text and semantic search
            const textResults = await this.textSearch(query, mongoQuery);
            const semanticResults = await semanticSearchService.search(query, userId, 20);

            // Merge and deduplicate
            const merged = this.mergeResults(textResults, semanticResults);

            logger.info('Faceted search completed', {
                context: 'FacetedSearchService',
                resultsCount: merged.length
            });

            return merged;
        } catch (error) {
            logger.error('Faceted search failed', error);
            throw error;
        }
    }

    async getFacets(query: string, userId: string): Promise<any> {
        try {
            const results = await this.search(query, {}, userId);

            const facets = {
                folders: this.extractFolders(results),
                dateRanges: this.extractDateRanges(results),
                types: this.extractTypes(results),
                hasAttachments: this.countAttachments(results)
            };

            logger.debug('Facets extracted', {
                context: 'FacetedSearchService',
                facetCounts: {
                    folders: facets.folders.length,
                    dateRanges: facets.dateRanges.length,
                    types: facets.types.length
                }
            });

            return facets;
        } catch (error) {
            logger.error('Facet extraction failed', error);
            throw error;
        }
    }

    private async textSearch(query: string, mongoQuery: any): Promise<any[]> {
        // TODO: Implement MongoDB text search
        logger.debug('Text search (placeholder)', {
            context: 'FacetedSearchService',
            query
        });
        return [];
    }

    private mergeResults(textResults: any[], semanticResults: any[]): any[] {
        const merged = new Map();

        // Add text results
        textResults.forEach(r => merged.set(r.id, { ...r, source: 'text' }));

        // Add semantic results
        semanticResults.forEach(r => {
            if (merged.has(r.id)) {
                // Boost score if found in both
                merged.get(r.id).score = (merged.get(r.id).score || 0) + (r.score || 0);
                merged.get(r.id).source = 'hybrid';
            } else {
                merged.set(r.id, { ...r, source: 'semantic' });
            }
        });

        // Sort by score
        return Array.from(merged.values()).sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    private extractFolders(results: any[]): any[] {
        const folders = new Map();
        results.forEach(r => {
            if (r.folderId) {
                folders.set(r.folderId, {
                    id: r.folderId,
                    name: r.folderName || 'Unnamed',
                    count: (folders.get(r.folderId)?.count || 0) + 1
                });
            }
        });
        return Array.from(folders.values());
    }

    private extractDateRanges(results: any[]): any[] {
        const ranges = [
            { label: 'Today', count: 0 },
            { label: 'This Week', count: 0 },
            { label: 'This Month', count: 0 },
            { label: 'Older', count: 0 }
        ];

        const now = Date.now();
        const day = 24 * 60 * 60 * 1000;

        results.forEach(r => {
            const age = now - new Date(r.timestamp).getTime();
            if (age < day) ranges[0].count++;
            else if (age < 7 * day) ranges[1].count++;
            else if (age < 30 * day) ranges[2].count++;
            else ranges[3].count++;
        });

        return ranges.filter(r => r.count > 0);
    }

    private extractTypes(results: any[]): any[] {
        const types = new Map();
        results.forEach(r => {
            const type = r.role || r.messageType || 'unknown';
            types.set(type, {
                type,
                count: (types.get(type)?.count || 0) + 1
            });
        });
        return Array.from(types.values());
    }

    private countAttachments(results: any[]): { withAttachments: number; withoutAttachments: number } {
        let withAttachments = 0;
        let withoutAttachments = 0;

        results.forEach(r => {
            if (r.hasAttachments) withAttachments++;
            else withoutAttachments++;
        });

        return { withAttachments, withoutAttachments };
    }
}

export const facetedSearchService = new FacetedSearchService();
