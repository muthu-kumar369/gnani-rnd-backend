// gnani-rnd-backend/src/modules/memory/services/memory-scorer.service.ts

import { createContextualLogger } from '../../../core/logger/logger.js';
import ConversationSummary from '../entities/conversation-summary.entity.js';

const logger = createContextualLogger({ module: 'MemoryScorer' });

interface Memory {
    _id: any;
    timestamp: Date;
    accessCount: number;
    relevanceScore: number;
    summary: string;
    userId: string;
}

export class MemoryScorerService {
    /**
     * Score a memory based on recency, frequency, and relevance
     * Total score: 0-100 points
     */
    scoreMemory(memory: Memory): number {
        let score = 0;

        // Recency (0-30 points)
        // More recent memories get higher scores
        const ageInDays = (Date.now() - new Date(memory.timestamp).getTime()) / (1000 * 60 * 60 * 24);
        const recencyScore = Math.max(0, 30 - ageInDays);
        score += recencyScore;

        // Frequency (0-30 points)
        // Memories accessed more often get higher scores
        const frequencyScore = Math.min(30, (memory.accessCount || 0) * 3);
        score += frequencyScore;

        // Relevance (0-40 points)
        // Based on relevance score from vector search or manual tagging
        const relevanceScore = (memory.relevanceScore || 0) * 40;
        score += relevanceScore;

        logger.debug('Memory scored', {
            memoryId: memory._id,
            recency: recencyScore.toFixed(2),
            frequency: frequencyScore.toFixed(2),
            relevance: relevanceScore.toFixed(2),
            total: score.toFixed(2)
        });

        return score;
    }

    /**
     * Prune low-importance memories for a user
     * Keeps the top N memories based on importance score
     */
    async pruneMemories(userId: string, maxMemories: number = 1000): Promise<number> {
        try {
            logger.info('Starting memory pruning', { userId, maxMemories });

            // Fetch all memories for user
            const memories = await ConversationSummary.find({ userId }).lean();

            if (memories.length <= maxMemories) {
                logger.info('No pruning needed', {
                    userId,
                    currentCount: memories.length,
                    maxMemories
                });
                return 0;
            }

            // Score all memories
            const scored = memories.map(m => ({
                memory: m,
                score: this.scoreMemory({
                    _id: m._id,
                    timestamp: m.startTime || new Date(),
                    accessCount: (m.metadata as any)?.accessCount || 0,
                    relevanceScore: (m.metadata as any)?.relevanceScore || 0.5,
                    summary: m.summary,
                    userId: m.userId
                })
            }));

            // Sort by score (highest first)
            scored.sort((a, b) => b.score - a.score);

            // Keep top N, delete rest
            const toKeep = scored.slice(0, maxMemories);
            const toDelete = scored.slice(maxMemories);

            const deleteIds = toDelete.map(s => s.memory._id);

            // Delete low-importance memories
            const result = await ConversationSummary.deleteMany({
                _id: { $in: deleteIds }
            });

            logger.info('Memory pruning completed', {
                userId,
                totalMemories: memories.length,
                kept: toKeep.length,
                deleted: result.deletedCount,
                lowestKeptScore: toKeep[toKeep.length - 1]?.score.toFixed(2),
                highestDeletedScore: toDelete[0]?.score.toFixed(2)
            });

            return result.deletedCount || 0;
        } catch (error: any) {
            logger.error('Memory pruning failed', { error: error.message, userId });
            throw error;
        }
    }

    /**
     * Get memory statistics for a user
     */
    async getMemoryStats(userId: string): Promise<any> {
        try {
            const memories = await ConversationSummary.find({ userId }).lean();

            if (memories.length === 0) {
                return {
                    total: 0,
                    averageScore: 0,
                    scoreDistribution: {}
                };
            }

            const scores = memories.map(m => this.scoreMemory({
                _id: m._id,
                timestamp: m.startTime || new Date(),
                accessCount: (m.metadata as any)?.accessCount || 0,
                relevanceScore: (m.metadata as any)?.relevanceScore || 0.5,
                summary: m.summary,
                userId: m.userId
            }));

            const averageScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

            // Score distribution
            const distribution = {
                high: scores.filter(s => s >= 70).length,
                medium: scores.filter(s => s >= 40 && s < 70).length,
                low: scores.filter(s => s < 40).length
            };

            return {
                total: memories.length,
                averageScore: averageScore.toFixed(2),
                scoreDistribution: distribution
            };
        } catch (error: any) {
            logger.error('Failed to get memory stats', { error: error.message, userId });
            return null;
        }
    }
}

export default new MemoryScorerService();
