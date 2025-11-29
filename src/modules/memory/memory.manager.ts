// src/modules/memory/memory.manager.ts
import { createContextualLogger } from '../../core/logger/logger.js';
import shortTermMemory from './services/short-term-memory.service.js';
import longTermMemory from './services/long-term-memory.service.js';
import sessionMemory from './services/session-memory.service.js';
import { IConversationMessage } from './entities/conversation.entity.js';
import { Logger } from 'winston';

interface MemoryContext {
    shortTermMessages: any[];
    longTermMemories: string[];
    sessionState: any;
    metadata: {
        shortTermCount: number;
        longTermCount: number;
        cacheHit: boolean;
        retrievalTime: number;
    };
}

interface RankedMemory {
    content: string;
    score: number;
    timestamp?: Date;
    type: 'short-term' | 'long-term';
}

class MemoryManager {
    private logger: Logger;
    private MAX_CONTEXT_TOKENS: number;
    private LONG_TERM_TOP_K: number;
    private SUMMARIZATION_BATCH_SIZE: number;

    constructor() {
        this.logger = createContextualLogger({ module: 'MemoryManager' });
        this.MAX_CONTEXT_TOKENS = parseInt(process.env.MEMORY_MAX_CONTEXT_TOKENS || '4000', 10);
        this.LONG_TERM_TOP_K = parseInt(process.env.MEMORY_LONG_TERM_TOP_K || '5', 10);
        this.SUMMARIZATION_BATCH_SIZE = parseInt(process.env.MEMORY_SUMMARIZATION_BATCH_SIZE || '10', 10);
        this.logger.info('MemoryManager initialized.');
    }

    /**
     * Main entry point: Get complete context for prompt building
     */
    async getContextForPrompt(
        userId: string,
        sessionId: string,
        currentQuery: string,
        tokenBudget?: number
    ): Promise<MemoryContext> {
        const startTime = Date.now();
        const budget = tokenBudget || this.MAX_CONTEXT_TOKENS;

        try {
            // 1. Get session state from Redis
            const sessionState = await sessionMemory.getSessionState(sessionId);

            // 2. Try to get recent messages from Redis cache first
            let shortTermMessages: any[] = [];
            let cacheHit = false;

            const cachedMessages = await sessionMemory.getCachedMessages(sessionId);
            if (cachedMessages && cachedMessages.length > 0) {
                shortTermMessages = cachedMessages;
                cacheHit = true;
                this.logger.debug(`Cache HIT for session ${sessionId}`);
            } else {
                // Fallback to MongoDB
                const messages = await shortTermMemory.getRecentMessages(userId, 20);
                shortTermMessages = this.formatMessages(messages);
                
                // Cache for next time
                if (shortTermMessages.length > 0) {
                    await sessionMemory.cacheRecentMessages(sessionId, shortTermMessages);
                }
                this.logger.debug(`Cache MISS for session ${sessionId}, loaded from MongoDB`);
            }

            // 3. Get relevant long-term memories from ChromaDB (with timeout)
            let longTermMemories: string[] = [];
            try {
                const longTermPromise = longTermMemory.retrieveRelevantMemories(
                    userId,
                    currentQuery,
                    this.LONG_TERM_TOP_K
                );
                
                // Race against a 2-second timeout
                const timeoutPromise = new Promise<string[]>((_, reject) => 
                    setTimeout(() => reject(new Error('Long-term memory retrieval timed out')), 2000)
                );

                longTermMemories = await Promise.race([longTermPromise, timeoutPromise]);
            } catch (err: any) {
                this.logger.warn(`Long-term memory retrieval skipped: ${err.message}`);
                // Continue without long-term memory
            }

            // 4. Rank and prioritize memories based on token budget
            const rankedMemories = this.rankMemories(
                shortTermMessages,
                longTermMemories,
                currentQuery,
                budget
            );

            // 5. Split back into short-term and long-term
            const finalShortTerm = rankedMemories
                .filter(m => m.type === 'short-term')
                .map(m => m.content);
            
            const finalLongTerm = rankedMemories
                .filter(m => m.type === 'long-term')
                .map(m => m.content);

            const retrievalTime = Date.now() - startTime;
            this.logger.info(
                `Retrieved context for ${userId}: ${finalShortTerm.length} short-term, ` +
                `${finalLongTerm.length} long-term (${retrievalTime}ms)`
            );

            return {
                shortTermMessages: finalShortTerm,
                longTermMemories: finalLongTerm,
                sessionState: sessionState || {},
                metadata: {
                    shortTermCount: finalShortTerm.length,
                    longTermCount: finalLongTerm.length,
                    cacheHit,
                    retrievalTime
                }
            };
        } catch (error: any) {
            this.logger.error(`Error getting context for prompt: ${error.message}`);
            return {
                shortTermMessages: [],
                longTermMemories: [],
                sessionState: {},
                metadata: {
                    shortTermCount: 0,
                    longTermCount: 0,
                    cacheHit: false,
                    retrievalTime: Date.now() - startTime
                }
            };
        }
    }

    /**
     * Store a new interaction (user message + assistant response)
     */
    async storeInteraction(
        userId: string,
        sessionId: string,
        userMessage: string,
        assistantMessage: string,
        metadata: any = {}
    ): Promise<void> {
        try {
            // Store user message
            await shortTermMemory.storeMessage(
                userId,
                sessionId,
                'user',
                userMessage,
                metadata
            );

            // Store assistant message
            await shortTermMemory.storeMessage(
                userId,
                sessionId,
                'assistant',
                assistantMessage,
                metadata
            );

            // Update Redis cache
            const recentMessages = await shortTermMemory.getRecentMessages(userId, 20);
            const formattedMessages = this.formatMessages(recentMessages);
            await sessionMemory.cacheRecentMessages(sessionId, formattedMessages);

            // Update session state
            await sessionMemory.updateSessionState(sessionId, {
                userId,
                lastIntent: metadata.intent,
                lastAction: metadata.action,
                lastActivity: Date.now()
            });

            // Check if we need to trigger summarization
            await this.checkAndTriggerSummarization(userId);

            this.logger.debug(`Stored interaction for session ${sessionId}`);
        } catch (error: any) {
            this.logger.error(`Error storing interaction: ${error.message}`);
        }
    }

    /**
     * Format messages for context
     */
    private formatMessages(messages: IConversationMessage[]): any[] {
        return messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            metadata: msg.metadata
        }));
    }

    /**
     * Rank and prioritize memories based on relevance and token budget
     */
    private rankMemories(
        shortTermMessages: any[],
        longTermMemories: string[],
        currentQuery: string,
        tokenBudget: number
    ): RankedMemory[] {
        const rankedMemories: RankedMemory[] = [];

        // Convert short-term messages to ranked memories
        shortTermMessages.forEach((msg, index) => {
            const recencyScore = 1.0 - (index / shortTermMessages.length) * 0.5; // 0.5 to 1.0
            rankedMemories.push({
                content: msg,
                score: recencyScore,
                timestamp: msg.timestamp,
                type: 'short-term'
            });
        });

        // Convert long-term memories to ranked memories
        longTermMemories.forEach((memory, index) => {
            const relevanceScore = 1.0 - (index / longTermMemories.length) * 0.3; // 0.7 to 1.0
            rankedMemories.push({
                content: memory,
                score: relevanceScore,
                type: 'long-term'
            });
        });

        // Sort by score (highest first)
        rankedMemories.sort((a, b) => b.score - a.score);

        // Apply token budget (rough estimation: 4 chars ≈ 1 token)
        const maxChars = tokenBudget * 4;
        let currentChars = 0;
        const filteredMemories: RankedMemory[] = [];

        for (const memory of rankedMemories) {
            const memoryChars = typeof memory.content === 'string' 
                ? memory.content.length 
                : JSON.stringify(memory.content).length;

            if (currentChars + memoryChars <= maxChars) {
                filteredMemories.push(memory);
                currentChars += memoryChars;
            } else {
                break;
            }
        }

        return filteredMemories;
    }

    /**
     * Check if summarization is needed and trigger it
     */
    private async checkAndTriggerSummarization(userId: string): Promise<void> {
        try {
            const stats = await shortTermMemory.getUserStats(userId);
            
            // If user has more than 100 messages, check for old ones
            if (stats.totalMessages > 100) {
                const oldMessages = await shortTermMemory.getMessagesForSummarization(
                    userId,
                    this.SUMMARIZATION_BATCH_SIZE
                );

                if (oldMessages.length > 0) {
                    // Process in background (don't await)
                    this.processSummarization(userId, oldMessages).catch(err => {
                        this.logger.error(`Background summarization error: ${err.message}`);
                    });
                }
            }
        } catch (error: any) {
            this.logger.error(`Error checking summarization: ${error.message}`);
        }
    }

    /**
     * Process summarization in background
     */
    private async processSummarization(
        userId: string,
        messages: IConversationMessage[]
    ): Promise<void> {
        try {
            this.logger.info(`Starting background summarization for ${messages.length} messages`);
            await longTermMemory.processOldConversations(userId, messages);
            this.logger.info(`Completed background summarization for user ${userId}`);
        } catch (error: any) {
            this.logger.error(`Error in background summarization: ${error.message}`);
        }
    }

    /**
     * Manually trigger summarization for a user
     */
    async triggerSummarization(userId: string): Promise<void> {
        try {
            const oldMessages = await shortTermMemory.getMessagesForSummarization(
                userId,
                this.SUMMARIZATION_BATCH_SIZE
            );

            if (oldMessages.length > 0) {
                await this.processSummarization(userId, oldMessages);
            } else {
                this.logger.info(`No messages to summarize for user ${userId}`);
            }
        } catch (error: any) {
            this.logger.error(`Error triggering summarization: ${error.message}`);
        }
    }

    /**
     * Clear all memory for a session
     */
    async clearSessionMemory(sessionId: string): Promise<void> {
        try {
            await sessionMemory.clearSessionCache(sessionId);
            this.logger.info(`Cleared session memory for ${sessionId}`);
        } catch (error: any) {
            this.logger.error(`Error clearing session memory: ${error.message}`);
        }
    }

    /**
     * Get memory statistics for a user
     */
    async getUserMemoryStats(userId: string): Promise<any> {
        try {
            const shortTermStats = await shortTermMemory.getUserStats(userId);
            const activeSessions = await sessionMemory.getActiveSessions();

            return {
                shortTerm: shortTermStats,
                activeSessions: activeSessions.length,
                timestamp: new Date()
            };
        } catch (error: any) {
            this.logger.error(`Error getting memory stats: ${error.message}`);
            return null;
        }
    }
}

export default new MemoryManager();
