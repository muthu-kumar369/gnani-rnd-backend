import { VectorManager } from '../vector/vector.manager.js';
import ConversationSummary from './entities/conversation-summary.entity.js';
import logger from '../../core/logger/logger.js';

interface ConversationLink {
    conversationId: string;
    relevance: number;
    sharedTopics: string[];
    timestamp: Date;
}

export class CrossConversationMemoryService {

    constructor(private readonly vectorManager: VectorManager) { }

    /**
     * Find related conversations
     */
    async findRelatedConversations(
        currentConversationId: string,
        userId: string,
        limit: number = 5
    ): Promise<ConversationLink[]> {
        logger.debug(`Finding related conversations for ${currentConversationId} (User: ${userId})`);

        // Get current conversation summary
        const currentSummary = await this.getConversationSummary(currentConversationId);
        if (!currentSummary) {
            logger.warn(`No summary found for conversation ${currentConversationId}`);
            return [];
        }

        // Search for similar conversations using VectorManager
        // We search for documents similar to the current summary
        // Filter out the current conversation ID
        // Note: This assumes summaries are indexed in vector DB with metadata containing 'conversationId'
        const results = await this.vectorManager.search(
            currentSummary,
            limit,
            {
                userId,
                conversationId: { $ne: currentConversationId }
            }
        );

        // Convert to conversation links
        return results.map(r => ({
            conversationId: r.metadata.conversationId,
            relevance: 1 - r.distance, // Convert distance to relevance score
            sharedTopics: this.extractSharedTopics(currentSummary, r.document),
            timestamp: new Date(r.metadata.timestamp || Date.now()),
        }));
    }

    /**
     * Get conversation summary
     */
    private async getConversationSummary(conversationId: string): Promise<string> {
        try {
            // Fetch from database
            const summaryDoc = await ConversationSummary.findOne({
                conversationIds: conversationId
            }).sort({ createdAt: -1 });

            if (summaryDoc) {
                return summaryDoc.summary;
            }

            return '';
        } catch (error: any) {
            logger.error(`Error fetching summary for conversation ${conversationId}: ${error.message}`);
            return '';
        }
    }

    /**
     * Extract shared topics between conversations
     */
    private extractSharedTopics(summary1: string, summary2: string): string[] {
        // Simple keyword extraction
        const keywords1 = this.extractKeywords(summary1);
        const keywords2 = this.extractKeywords(summary2);

        return keywords1.filter(k => keywords2.includes(k));
    }

    private extractKeywords(text: string): string[] {
        // Simple keyword extraction (can be enhanced with NLP)
        // Remove punctuation, lowercase, split, filter short words and common stop words
        const stopWords = new Set(['the', 'and', 'that', 'this', 'with', 'from', 'have', 'what', 'when', 'where']);

        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 4 && !stopWords.has(word))
            .slice(0, 10);
    }

    /**
     * Get enriched context from related conversations
     */
    async getEnrichedContext(
        currentConversationId: string,
        userId: string,
        query: string
    ): Promise<string> {
        try {
            // Find related conversations
            const links = await this.findRelatedConversations(currentConversationId, userId, 3);

            if (links.length === 0) {
                return '';
            }

            // Build context from related conversations
            const contextParts: string[] = [];
            contextParts.push('## Related Context from Previous Conversations:');

            for (const link of links) {
                const summary = await this.getConversationSummary(link.conversationId);
                if (summary) {
                    contextParts.push(
                        `\n**Related Topic** (${link.sharedTopics.slice(0, 3).join(', ')}):\n${summary.substring(0, 200)}...`
                    );
                }
            }

            return contextParts.join('\n');
        } catch (error: any) {
            logger.error(`Error getting enriched context: ${error.message}`);
            return '';
        }
    }
}

// Export singleton
import vectorManager from '../vector/vector.manager.js';
export default new CrossConversationMemoryService(vectorManager);
