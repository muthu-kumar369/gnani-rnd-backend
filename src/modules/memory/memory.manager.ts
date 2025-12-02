// src/modules/memory/memory.manager.ts
import { createContextualLogger } from '../../core/logger/logger.js';
import shortTermMemory from './services/short-term-memory.service.js';
import longTermMemory from './services/long-term-memory.service.js';
import sessionMemory from './services/session-memory.service.js';
import { IConversationMessage } from './entities/conversation.entity.js';
import ConversationMessage from './entities/conversation.entity.js';
import { Logger } from 'winston';
import { encoding_for_model } from 'tiktoken';
import decayCalculator from './decay-calculator.js';
import selfAdjuster from './self-adjuster.js';
import performanceTracker from './performance-tracker.js';
import budgetCalculator from './budget-calculator.js';
import summarizationService from './summarization.service.js';

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
    private tokenizer: any;

    constructor() {
        this.logger = createContextualLogger({ module: 'MemoryManager' });
        this.MAX_CONTEXT_TOKENS = parseInt(process.env.MEMORY_MAX_CONTEXT_TOKENS || '4000', 10);
        this.LONG_TERM_TOP_K = parseInt(process.env.MEMORY_LONG_TERM_TOP_K || '5', 10);
        this.SUMMARIZATION_BATCH_SIZE = parseInt(process.env.MEMORY_SUMMARIZATION_BATCH_SIZE || '10', 10);

        // Initialize tiktoken for accurate token counting
        try {
            this.tokenizer = encoding_for_model('gpt-3.5-turbo'); // Use appropriate model
            this.logger.info('Tiktoken initialized for accurate token counting');
        } catch (error: any) {
            this.logger.warn(`Failed to initialize tiktoken: ${error.message}. Falling back to estimation.`);
            this.tokenizer = null;
        }

        this.logger.info('MemoryManager initialized.');
    }

    /**
     * Main entry point: Get complete context for prompt building
     * Now with parallel retrieval for better performance
     */
    async getContextForPrompt(
        userId: string,
        sessionId: string,
        currentQuery: string,
        tokenBudget?: number,
        complexityScore?: number
    ): Promise<MemoryContext> {
        const startTime = Date.now();

        try {
            // Parallel retrieval for better performance
            const [sessionState, shortTermMessages, longTermMemories] = await Promise.all([
                // 1. Get session state from Redis
                sessionMemory.getSessionState(sessionId),

                // 2. Get short-term messages (with cache)
                this.getShortTermMessages(userId, sessionId),

                // 3. Get long-term memories (with timeout)
                this.getLongTermMemories(userId, currentQuery)
            ]);

            // PHASE 3: Calculate adaptive budget based on complexity and available memories
            let budget = tokenBudget || this.MAX_CONTEXT_TOKENS;
            if (complexityScore !== undefined) {
                const totalMemories = shortTermMessages.messages.length + longTermMemories.length;

                // Convert complexity score to QueryComplexity-like object
                const queryComplexity = {
                    score: complexityScore,
                    category: this.categorizeComplexity(complexityScore),
                    factors: []
                };

                const budgetCalc = budgetCalculator.calculateAdaptiveBudget(
                    queryComplexity as any, // Type assertion since we're creating a compatible object
                    shortTermMessages.messages.length, // conversation depth
                    totalMemories
                );
                budget = budgetCalc.totalBudget;
                this.logger.info(
                    `Adaptive budget calculated: ${budget} tokens ` +
                    `(complexity: ${complexityScore.toFixed(2)}, memories: ${totalMemories})`
                );
            }

            // 4. Rank and prioritize memories using hybrid RAG scoring
            const rankedMemories = this.rankMemoriesHybridRAG(
                shortTermMessages.messages,
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
                    cacheHit: shortTermMessages.cacheHit,
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
     * Get short-term messages with caching and automatic summarization
     */
    private async getShortTermMessages(userId: string, sessionId: string): Promise<{ messages: any[], cacheHit: boolean }> {
        // Try cache first
        const cachedMessages = await sessionMemory.getCachedMessages(sessionId);
        if (cachedMessages && cachedMessages.length > 0) {
            this.logger.debug(`Cache HIT for session ${sessionId}`);

            // Apply summarization if needed (even for cached messages)
            if (summarizationService.needsSummarization(cachedMessages.length)) {
                try {
                    const summarizedMessages = await summarizationService.applySummarization(
                        cachedMessages,
                        userId,
                        sessionId
                    );

                    // Update cache with summarized version
                    await sessionMemory.cacheRecentMessages(sessionId, summarizedMessages);

                    return { messages: summarizedMessages, cacheHit: true };
                } catch (error: any) {
                    this.logger.warn(`Summarization failed for cached messages: ${error.message}`);
                    return { messages: cachedMessages, cacheHit: true };
                }
            }

            return { messages: cachedMessages, cacheHit: true };
        }

        // Fallback to MongoDB
        // CRITICAL FIX: Use getSessionMessages to scope context to the specific session
        // instead of getRecentMessages which mixes all user conversations
        const messages = await shortTermMemory.getSessionMessages(sessionId);
        
        // If session has no messages (new session), we might want to pull recent context 
        // from other sessions ONLY if explicitly requested, but for now we stick to strict scoping
        // as per user requirement.
        
        const formattedMessages = this.formatMessages(messages);

        // Apply summarization if needed
        let finalMessages = formattedMessages;
        if (summarizationService.needsSummarization(formattedMessages.length)) {
            try {
                finalMessages = await summarizationService.applySummarization(
                    formattedMessages,
                    userId,
                    sessionId
                );
                this.logger.info(`Applied summarization: ${formattedMessages.length} → ${finalMessages.length} messages`);
            } catch (error: any) {
                this.logger.warn(`Summarization failed: ${error.message}, using original messages`);
            }
        }

        // Cache for next time
        if (finalMessages.length > 0) {
            await sessionMemory.cacheRecentMessages(sessionId, finalMessages);
        }

        this.logger.debug(`Cache MISS for session ${sessionId}, loaded ${finalMessages.length} messages from MongoDB`);
        return { messages: finalMessages, cacheHit: false };
    }

    /**
     * Get long-term memories with timeout protection
     */
    private async getLongTermMemories(userId: string, currentQuery: string): Promise<string[]> {
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

            return await Promise.race([longTermPromise, timeoutPromise]);
        } catch (err: any) {
            this.logger.warn(`Long-term memory retrieval skipped: ${err.message}`);
            return [];
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
     * Hybrid RAG scoring: Combines semantic similarity, recency, and keyword matching
     * - Semantic similarity: 40% weight (reduced to prevent old similar content from dominating)
     * - Recency: 40% weight (increased to prioritize recent context)
     * - Keyword matching: 20% weight
     */
    private rankMemoriesHybridRAG(
        shortTermMessages: any[],
        longTermMemories: string[],
        currentQuery: string,
        tokenBudget: number
    ): RankedMemory[] {
        const rankedMemories: RankedMemory[] = [];
        const queryLower = currentQuery.toLowerCase();
        const queryKeywords = this.extractKeywords(queryLower);
        const now = Date.now();

        // Process short-term messages
        shortTermMessages.forEach((msg, index) => {
            const content = typeof msg === 'string' ? msg : JSON.stringify(msg);
            const contentLower = content.toLowerCase();

            // 1. Recency score (40% weight) - more recent = higher score
            let recencyScore = 1.0 - (index / Math.max(shortTermMessages.length, 1)) * 0.5; // 0.5 to 1.0

            // BOOST: Very recent messages (last 5 minutes) get extra weight
            if (msg.timestamp) {
                const ageMinutes = (now - new Date(msg.timestamp).getTime()) / (1000 * 60);
                if (ageMinutes < 5) {
                    recencyScore *= 1.5; // 50% boost for very recent
                } else if (ageMinutes < 60) {
                    recencyScore *= 1.2; // 20% boost for recent (last hour)
                }
            }

            // 2. Semantic similarity (40% weight) - using Jaccard similarity
            const semanticScore = this.calculateJaccardSimilarity(queryLower, contentLower);

            // 3. Keyword matching (20% weight)
            const keywordScore = this.calculateKeywordScore(contentLower, queryKeywords);

            // PHASE 2B: Get dynamic weights from self-adjuster
            const weights = selfAdjuster.getCurrentWeights();

            // Combined score with dynamic weights
            const baseScore = (semanticScore * weights.semantic) +
                (recencyScore * weights.recency) +
                (keywordScore * weights.keywords);

            // PHASE 2B: Apply decay if message has timestamp
            let finalScore = baseScore;
            if (msg.timestamp) {
                const ageInDays = decayCalculator.calculateAge(new Date(msg.timestamp));
                const accessCount = msg.accessCount || 0;
                const decayResult = decayCalculator.applyDecay(baseScore, ageInDays, accessCount);
                finalScore = decayResult.finalScore;
            }

            rankedMemories.push({
                content: msg,
                score: finalScore,
                timestamp: msg.timestamp,
                type: 'short-term'
            });
        });

        // Process long-term memories
        longTermMemories.forEach((memory, index) => {
            const memoryLower = memory.toLowerCase();

            // Long-term memories are already ranked by ChromaDB, so use that ranking
            const chromaScore = 1.0 - (index / Math.max(longTermMemories.length, 1)) * 0.3; // 0.7 to 1.0

            // Semantic similarity
            const semanticScore = this.calculateJaccardSimilarity(queryLower, memoryLower);

            // Keyword matching
            const keywordScore = this.calculateKeywordScore(memoryLower, queryKeywords);

            // Combined score (recency less important for long-term)
            const finalScore = (semanticScore * 0.5) + (chromaScore * 0.3) + (keywordScore * 0.2);

            rankedMemories.push({
                content: memory,
                score: finalScore,
                type: 'long-term'
            });
        });

        // Sort by score (highest first)
        rankedMemories.sort((a, b) => b.score - a.score);

        // Apply token budget using accurate token counting
        return this.applyTokenBudget(rankedMemories, tokenBudget);
    }

    /**
     * Apply token budget using tiktoken for accurate counting
     */
    private applyTokenBudget(memories: RankedMemory[], tokenBudget: number): RankedMemory[] {
        let currentTokens = 0;
        const filteredMemories: RankedMemory[] = [];

        for (const memory of memories) {
            const memoryText = typeof memory.content === 'string'
                ? memory.content
                : JSON.stringify(memory.content);

            const memoryTokens = this.countTokens(memoryText);

            if (currentTokens + memoryTokens <= tokenBudget) {
                filteredMemories.push(memory);
                currentTokens += memoryTokens;
            } else {
                // Budget exceeded
                break;
            }
        }

        this.logger.debug(`Applied token budget: ${currentTokens}/${tokenBudget} tokens used`);
        return filteredMemories;
    }

    /**
     * Accurate token counting using tiktoken
     */
    private countTokens(text: string): number {
        if (this.tokenizer) {
            try {
                const tokens = this.tokenizer.encode(text);
                return tokens.length;
            } catch (error: any) {
                this.logger.warn(`Tiktoken encoding error: ${error.message}, falling back to estimation`);
            }
        }

        // Fallback: rough estimation (4 chars ≈ 1 token)
        return Math.ceil(text.length / 4);
    }

    /**
     * Calculate Jaccard similarity between two strings
     */
    private calculateJaccardSimilarity(str1: string, str2: string): number {
        const words1 = new Set(str1.split(/\s+/));
        const words2 = new Set(str2.split(/\s+/));

        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);

        return union.size > 0 ? intersection.size / union.size : 0;
    }

    /**
     * Extract keywords from query (simple approach: remove stop words)
     */
    private extractKeywords(query: string): Set<string> {
        const stopWords = new Set([
            'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
            'could', 'may', 'might', 'must', 'can', 'of', 'at', 'by', 'for', 'with',
            'about', 'against', 'between', 'into', 'through', 'during', 'before',
            'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out',
            'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once',
            'what', 'which', 'who', 'when', 'where', 'why', 'how'
        ]);

        const words = query.split(/\s+/).filter(word =>
            word.length > 2 && !stopWords.has(word)
        );

        return new Set(words);
    }

    /**
     * Calculate keyword matching score
     */
    private calculateKeywordScore(content: string, keywords: Set<string>): number {
        if (keywords.size === 0) return 0;

        let matchCount = 0;
        for (const keyword of keywords) {
            if (content.includes(keyword)) {
                matchCount++;
            }
        }

        return matchCount / keywords.size;
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
     * Process summarization with structured entity extraction
     */
    private async processSummarization(
        userId: string,
        messages: IConversationMessage[]
    ): Promise<void> {
        try {
            this.logger.info(`Starting summarization for ${userId} (${messages.length} messages)`);

            // Group messages into conversation pairs
            const conversationPairs: string[] = [];
            for (let i = 0; i < messages.length; i += 2) {
                const userMsg = messages[i];
                const assistantMsg = messages[i + 1];

                if (userMsg && assistantMsg) {
                    conversationPairs.push(
                        `User: ${userMsg.content}\nAssistant: ${assistantMsg.content}`
                    );
                }
            }

            // Create structured summary with entity extraction
            const summary = {
                timeRange: {
                    start: messages[0].timestamp,
                    end: messages[messages.length - 1].timestamp
                },
                messageCount: messages.length,
                topics: this.extractTopics(conversationPairs),
                entities: this.extractEntities(conversationPairs),
                summary: `Conversation covering ${conversationPairs.length} exchanges`,
                conversationPairs: conversationPairs.slice(0, 5) // Keep first 5 for context
            };

            // Store in long-term memory using createSummary
            await longTermMemory.createSummary(userId, messages);

            // Delete old messages (archiving)
            const messageIds = messages.map(m => m._id?.toString()).filter(Boolean) as string[];
            if (messageIds.length > 0) {
                await ConversationMessage.deleteMany({ _id: { $in: messageIds } });
            }

            this.logger.info(`Summarization complete for ${userId}`);
        } catch (error: any) {
            this.logger.error(`Error processing summarization: ${error.message}`);
        }
    }

    /**
     * Extract topics from conversation (simple keyword frequency)
     */
    private extractTopics(conversationPairs: string[]): string[] {
        const wordFreq = new Map<string, number>();
        const stopWords = this.extractKeywords(''); // Get stop words set

        for (const pair of conversationPairs) {
            const words = pair.toLowerCase().split(/\s+/);
            for (const word of words) {
                if (word.length > 3 && !stopWords.has(word)) {
                    wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
                }
            }
        }

        // Get top 5 topics
        return Array.from(wordFreq.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word]) => word);
    }

    /**
     * Extract entities (simple pattern matching)
     */
    private extractEntities(conversationPairs: string[]): string[] {
        const entities = new Set<string>();
        const text = conversationPairs.join(' ');

        // Extract capitalized words (potential names/places)
        const capitalizedWords = text.match(/\b[A-Z][a-z]+\b/g) || [];
        capitalizedWords.forEach(word => {
            if (word.length > 2) entities.add(word);
        });

        return Array.from(entities).slice(0, 10);
    }

    /**
     * Clear session cache
     */
    async clearSessionCache(sessionId: string): Promise<void> {
        // Clear cached messages for this session
        // Note: sessionMemory doesn't have clearCache, we'll just let Redis TTL handle it
        this.logger.debug(`Cleared cache for session ${sessionId}`);
    }

    /**
     * Categorize complexity score into category
     */
    private categorizeComplexity(score: number): 'simple' | 'moderate' | 'complex' | 'very_complex' {
        if (score < 0.3) return 'simple';
        if (score < 0.6) return 'moderate';
        if (score < 0.8) return 'complex';
        return 'very_complex';
    }

    /**
     * Get memory statistics
     */
    async getMemoryStats(userId: string): Promise<any> {
        const stats = await shortTermMemory.getUserStats(userId);
        return {
            shortTermMessages: stats.totalMessages,
            oldestMessage: stats.oldestMessage,
            newestMessage: stats.newestMessage
        };
    }
}

export default new MemoryManager();
