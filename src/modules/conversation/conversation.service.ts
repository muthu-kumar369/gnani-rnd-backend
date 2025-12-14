import Conversation, { IConversation } from './conversation.model.js';
import ConversationMessage from '../memory/entities/conversation.entity.js';
import { Feedback } from '../../models/feedback.model.js'; // STAGE 14
import llmService from '../llm/llm.service.js';
import shortTermMemory from '../memory/services/short-term-memory.service.js';
import { createContextualLogger } from '../../core/logger/logger.js';
import { Types } from 'mongoose';
import sessionCoordinator from '../session/session.coordinator.js';
import { redisClient } from '../../config/redis.config.js'; // STAGE 13
import { validateMessage } from './message-validator.js'; // STAGE 1
import vectorManager from '../vector/vector.manager.js'; // STAGE 3

interface PaginationOptions {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

class ConversationService {
    private logger = createContextualLogger({ module: 'ConversationService' });
    /**
     * List conversations for a user (STAGE 12: Optimized with aggregation pipeline)
     */
    async listConversations(userId: string, options: PaginationOptions = {}) {
        const page = Math.max(1, Number(options.page) || 1);
        const limit = Math.max(1, Math.min(50, Number(options.limit) || 20));
        const skip = (page - 1) * limit;

        // Map frontend sort keys to backend fields
        const sortMapping: Record<string, string> = {
            'date': 'updatedAt',
            'name': 'title',
            'messageCount': 'messageCount'
        };

        const sortBy = sortMapping[options.sortBy || 'date'] || 'updatedAt';
        const sortOrder = options.sortOrder === 'asc' ? 1 : -1;

        // STAGE 13 Step 1: Check Redis cache first
        // v2: Bump version to force invalidate cache after adding isPinned field
        const cacheKey = `v2:conversations:${userId}:page${page}:limit${limit}`;
        try {
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                this.logger.debug('Cache HIT for conversations list', { userId, page });
                return JSON.parse(cached);
            }
            this.logger.debug('Cache MISS for conversations list', { userId, page });
        } catch (error) {
            this.logger.warn('Redis cache read failed, continuing without cache', { error });
        }

        // STAGE 12 Step 3: Query explain for performance analysis (development only)
        if (process.env.NODE_ENV === 'development') {
            // Get query explanation for performance monitoring
            const explain = await Conversation.find({ userId, isDeleted: false })
                .sort({ [sortBy]: sortOrder })
                .explain('executionStats') as any;

            this.logger.info('Query performance', {
                executionTimeMs: explain.executionStats?.executionTimeMillis,
                totalDocsExamined: explain.executionStats?.totalDocsExamined,
                totalKeysExamined: explain.executionStats?.totalKeysExamined,
            });
        }

        // STAGE 12 Step 2: Optimized aggregation pipeline with $lookup
        const conversations = await Conversation.aggregate([
            // Match user's active conversations
            { $match: { userId, isDeleted: false } },

            // Sort by pinned first, then by the requested sort field
            { $sort: { isPinned: -1, [sortBy]: sortOrder } },

            // Pagination
            { $skip: skip },
            { $limit: limit },

            // Lookup last message from ConversationMessage collection
            {
                $lookup: {
                    from: 'conversation_messages',
                    let: { convId: '$conversationId' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$conversationId', '$$convId'] } } },
                        { $sort: { timestamp: -1 } },
                        { $limit: 1 },
                        { $project: { content: 1, timestamp: 1 } }
                    ],
                    as: 'lastMessage'
                }
            },

            // Project final shape
            {
                $project: {
                    _id: 1,
                    conversationId: 1,
                    title: 1,
                    updatedAt: 1,
                    createdAt: 1,
                    messageCount: 1,
                    isPinned: 1,
                    currentModel: 1,
                    currentTemplate: 1,
                    preview: {
                        $cond: {
                            if: { $gt: [{ $size: '$lastMessage' }, 0] },
                            then: { $substr: [{ $arrayElemAt: ['$lastMessage.content', 0] }, 0, 100] },
                            else: ''
                        }
                    },
                    lastMessageAt: {
                        $cond: {
                            if: { $gt: [{ $size: '$lastMessage' }, 0] },
                            then: { $arrayElemAt: ['$lastMessage.timestamp', 0] },
                            else: '$updatedAt'
                        }
                    }
                }
            }
        ]);

        // Get total count for pagination
        const total = await Conversation.countDocuments({ userId, isDeleted: false });

        const result = {
            conversations: conversations.map(conv => ({
                ...conv,
                id: conv._id
            })),
            total,
            page,
            limit,
            hasMore: total > skip + limit
        };

        // STAGE 13: Cache the result (5 sec TTL for better responsiveness)
        try {
            await redisClient.setex(cacheKey, 5, JSON.stringify(result));
            this.logger.debug('Cached conversations list', { userId, page, ttl: 5 });
        } catch (error) {
            this.logger.warn('Failed to cache conversations list', { error });
        }

        return result;
    }

    /**
     * Get full conversation details with messages
     */
    /**
     * Get full conversation details with messages
     */
    async getConversation(conversationId: string, userId: string) {
        const conversation = await Conversation.findOne({ conversationId, userId, isDeleted: false }).lean();

        if (!conversation) {
            return null;
        }

        const totalMessages = await ConversationMessage.countDocuments({ conversationId });

        // Fetch only latest 50 messages initially for performance
        const messages = await ConversationMessage.find({ conversationId, deletedAt: null })
            .sort({ timestamp: -1 })
            .limit(50)
            .lean();

        // Restore chronological order for the tree builder
        messages.reverse();

        // STAGE 14: Fetch feedback
        const messageIds = messages.map(m => m._id.toString());
        const feedbackList = await Feedback.find({
            messageId: { $in: messageIds },
            userId
        }).lean();

        const feedbackMap = new Map(feedbackList.map(f => [f.messageId, f]));

        return {
            ...conversation,
            id: conversation._id,
            hasMoreMessages: totalMessages > messages.length,
            messages: messages.map(msg => ({
                id: msg._id,
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp,
                parentId: msg.parentId,
                children: msg.children,
                branchIndex: msg.branchIndex,
                metadata: msg.metadata,
                feedback: feedbackMap.get(msg._id.toString()) ? {
                    rating: feedbackMap.get(msg._id.toString())!.rating,
                    comment: feedbackMap.get(msg._id.toString())!.comment,
                    category: feedbackMap.get(msg._id.toString())!.category
                } : undefined
            }))
        };
    }

    /**
     * Get paginated messages for a conversation
     */
    async getMessages(conversationId: string, userId: string, options: { limit?: number; before?: string } = {}) {
        const limit = Math.max(1, Math.min(100, options.limit || 50));
        const query: any = { conversationId, userId };

        if (options.before) {
            query.timestamp = { $lt: new Date(options.before) };
        }

        const messages = await ConversationMessage.find(query)
            .sort({ timestamp: -1 }) // Newest first
            .limit(limit)
            .lean();

        // Return in chronological order for frontend consistency (oldest -> newest)
        // But for pagination (infinite scroll up), we often want them reversed. 
        // Logic: Return as is, let frontend handle merging.
        // Actually, frontend expects linear chunks. 

        // STAGE 14: Fetch feedback
        const messageIds = messages.map(m => m._id.toString());
        const feedbackList = await Feedback.find({
            messageId: { $in: messageIds },
            userId
        }).lean();

        const feedbackMap = new Map(feedbackList.map(f => [f.messageId, f]));

        return {
            messages: messages.map(msg => ({
                id: msg._id,
                _id: msg._id,
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp,
                parentId: msg.parentId,
                children: msg.children,
                branchIndex: msg.branchIndex,
                metadata: msg.metadata,
                feedback: feedbackMap.get(msg._id.toString()) ? {
                    rating: feedbackMap.get(msg._id.toString())!.rating,
                    comment: feedbackMap.get(msg._id.toString())!.comment,
                    category: feedbackMap.get(msg._id.toString())!.category
                } : undefined
            })),
            hasMore: messages.length === limit
        };
    }

    /**
     * Search conversations (Basic, Semantic, Hybrid)
     */
    async searchConversations(userId: string, query: string, limit: number = 20, mode: 'basic' | 'semantic' | 'hybrid' = 'basic', filters: any = {}) {
        this.logger.info(`Searching conversations (Aggregation)`, { userId, query, filters });

        const trimmedQuery = query.trim();
        if (!trimmedQuery) return [];

        const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = escapeRegExp(trimmedQuery);
        // MongoDB regex query
        const regexMatch = { $regex: pattern, $options: 'i' };

        // Build Filter Query
        const matchQuery: any = {
            userId,
            isDeleted: false
        };

        if (filters) {
            if (filters.dateFrom || filters.dateTo) {
                matchQuery.createdAt = {};
                if (filters.dateFrom) matchQuery.createdAt.$gte = new Date(filters.dateFrom);
                if (filters.dateTo) matchQuery.createdAt.$lte = new Date(filters.dateTo);
            }

            if (filters.models && filters.models.length > 0) {
                matchQuery.currentModel = { $in: filters.models };
            } else if (filters.model) {
                matchQuery.currentModel = filters.model;
            }

            if (filters.folders && filters.folders.length > 0) {
                matchQuery.folderId = { $in: filters.folders };
            }

            if (filters.tags && filters.tags.length > 0) {
                matchQuery.tags = { $in: filters.tags };
            }
        }

        // Helper to prefix keys for lookup match (e.g. 'isDeleted' -> 'conversation.isDeleted')
        const getLookupMatch = (baseQuery: any) => {
            const lookupQuery: any = {};
            for (const key of Object.keys(baseQuery)) {
                lookupQuery[`conversation.${key}`] = baseQuery[key];
            }
            return lookupQuery;
        };

        // Aggregation Pipeline
        const aggregationPipeline: any[] = [
            // 1. Match Conversations by Title AND Filters
            {
                $match: {
                    ...matchQuery,
                    title: regexMatch
                }
            },
            // Add metadata for Title matches
            {
                $addFields: {
                    matchType: 'title',
                    score: 1.0,
                    snippetContent: '$systemPrompt' // Fallback for title matches
                }
            },
            {
                $project: {
                    _id: 1,
                    conversationId: 1,
                    title: 1,
                    createdAt: 1,
                    currentModel: 1,
                    matchType: 1,
                    score: 1,
                    snippetContent: 1
                }
            },
            // 2. Union with Message Matches
            {
                $unionWith: {
                    coll: 'conversation_messages',
                    pipeline: [
                        {
                            $match: {
                                userId, // Always enforce userId on message level too for safety/speed
                                deletedAt: null,
                                content: regexMatch
                            }
                        },
                        // Optimization: Limit message scan 
                        { $limit: limit * 5 },

                        // Lookup parent conversation 
                        {
                            $lookup: {
                                from: 'conversations',
                                localField: 'conversationId',
                                foreignField: 'conversationId',
                                as: 'conversation'
                            }
                        },
                        { $unwind: '$conversation' },

                        // Apply Filters to the PARENT conversation
                        {
                            $match: getLookupMatch(matchQuery)
                        },

                        // Project to common shape
                        {
                            $project: {
                                _id: '$conversation._id',
                                conversationId: '$conversationId',
                                title: '$conversation.title',
                                createdAt: '$conversation.createdAt',
                                currentModel: '$conversation.currentModel',
                                matchType: 'content',
                                score: 0.8,
                                snippetContent: '$content'
                            }
                        }
                    ]
                }
            },
            // 3. Group by ConversationId to remove duplicates
            // We want to prioritize the entry with the highest score (Title match = 1.0, Content = 0.8)
            // OR prioritize content match if we want to show the message snippet?
            // Let's sort by score descending first
            { $sort: { score: -1, createdAt: -1 } },
            {
                $group: {
                    _id: '$conversationId',
                    doc: { $first: '$$ROOT' }, // Keep the highest scoring match
                    // If we have multiple matches, we might want to know.
                    matches: { $push: '$matchType' }
                }
            },
            { $replaceRoot: { newRoot: '$doc' } },

            // 4. Final Sort and Limit
            { $sort: { createdAt: -1 } }, // User usually wants recent relevant results
            { $limit: limit }
        ];





        const results = await Conversation.aggregate(aggregationPipeline);

        // Post-processing for smart snippets (easier in simple JS/Node than Mongo regex operators)
        const generateSnippet = (content: string, queryRegex: RegExp): string => {
            if (!content) return '';
            const matchIndex = content.search(queryRegex);
            if (matchIndex === -1) return content.substring(0, 150) + '...';

            const windowSize = 75;
            const start = Math.max(0, matchIndex - windowSize);
            const end = Math.min(content.length, matchIndex + windowSize);

            let snippet = content.substring(start, end);
            if (start > 0) snippet = '...' + snippet;
            if (end < content.length) snippet = snippet + '...';

            return snippet;
        };

        const finalResults = results.map(r => ({
            conversationId: r.conversationId,
            title: r.title,
            snippet: generateSnippet(r.snippetContent, new RegExp(pattern, 'i')),
            createdAt: r.createdAt,
            model: r.currentModel,
            score: r.score,
            matchType: r.matchType
        }));

        return finalResults;
    }

    /**
     * Soft delete conversation and cleanup associated files
     */
    /**
     * Soft delete conversation and cleanup associated files
     */
    async deleteConversation(conversationId: string, userId: string) {
        try {
            // Get all messages with attachments
            const messages = await ConversationMessage.find({ conversationId, userId });

            // Collect all file IDs from attachments
            const fileIds: string[] = [];
            messages.forEach(msg => {
                if (msg.attachments && msg.attachments.length > 0) {
                    msg.attachments.forEach((att: any) => {
                        if (att.fileId) {
                            fileIds.push(att.fileId);
                        }
                    });
                }
            });

            // Delete all associated files
            if (fileIds.length > 0) {
                const fileService = (await import('../file/file.service.js')).default;
                await Promise.all(
                    fileIds.map(fileId =>
                        fileService.deleteFile(fileId, userId).catch(err => {
                            console.error(`Failed to delete file ${fileId}:`, err);
                        })
                    )
                );
            }

            // Soft delete conversation
            const result = await Conversation.findOneAndUpdate(
                { conversationId, userId },
                { isDeleted: true },
                { new: true }
            );

            // STAGE 13 Step 3: Invalidate cache after deletion
            try {
                // Invalidate all pages of conversation list for this user
                const keys = await redisClient.keys(`v2:conversations:${userId}:*`);
                if (keys.length > 0) {
                    await redisClient.del(...keys);
                    this.logger.debug('Invalidated conversation list cache after deletion', { userId, conversationId });
                }
            } catch (error) {
                this.logger.warn('Failed to invalidate cache after deletion', { error });
            }

            return result;
        } catch (error: any) {
            console.error('Error deleting conversation:', error);
            throw error;
        }
    }

    /**
     * Update conversation title
     */
    async updateTitle(conversationId: string, userId: string, title: string) {
        const result = await Conversation.findOneAndUpdate(
            { conversationId, userId },
            { title, updatedAt: new Date() }, // Update timestamp to reflect change
            { new: true }
        );

        // Invalidate cache
        try {
            const keys = await redisClient.keys(`v2:conversations:${userId}:*`);
            if (keys.length > 0) await redisClient.del(...keys);
        } catch (error) {
            this.logger.warn('Failed to invalidate cache after title update', { error });
        }

        return result;
    }

    /**
     * Update conversation system prompt
     */
    async updateSystemPrompt(conversationId: string, userId: string, systemPrompt: string) {
        return Conversation.findOneAndUpdate(
            { conversationId, userId, isDeleted: false },
            { systemPrompt },
            { new: true }
        );
    }

    /**
     * Update conversation template
     */
    async updateConversationTemplate(conversationId: string, userId: string, templateId: string | null) {
        return Conversation.findOneAndUpdate(
            { conversationId, userId, isDeleted: false },
            { currentTemplate: templateId },
            { new: true }
        );
    }

    /**
     * Update conversation model
     */
    async updateConversationModel(conversationId: string, userId: string, modelId: string) {
        return Conversation.findOneAndUpdate(
            { conversationId, userId, isDeleted: false },
            { currentModel: modelId },
            { new: true }
        );
    }

    /**
     * Toggle conversation pin status
     */
    async togglePin(conversationId: string, userId: string) {
        const conversation = await Conversation.findOne({ conversationId, userId });
        if (!conversation) {
            throw new Error('Conversation not found');
        }

        const newPinnedState = !conversation.isPinned;

        const result = await Conversation.findOneAndUpdate(
            { conversationId, userId },
            { isPinned: newPinnedState },
            { new: true }
        );

        // Invalidate cache
        try {
            // Pattern delete not supported by basic redis driver usually, need keys first
            const keys = await redisClient.keys(`conversations:${userId}:*`);
            if (keys.length > 0) await redisClient.del(...keys);
        } catch (error) {
            // ignore cache error
        }

        return result;
    }

    /**
     * Generate conversation title based on first 2-3 messages
     * @param sessionId - Session ID of the conversation
     * @param userId - User ID
     * @returns Promise<string> - Generated title
     */
    /**
     * Generate conversation title based on first 2-3 messages
     * @param conversationId - Conversation ID
     * @param userId - User ID
     * @returns Promise<string> - Generated title
     */
    async generateConversationTitle(conversationId: string, userId: string): Promise<string> {
        try {
            this.logger.info(`Generating title for conversation ${conversationId}`);

            // Fetch first 3 messages from the database (more reliable than shortTermMemory which is ephemeral)
            const messages = await ConversationMessage.find({ conversationId })
                .sort({ timestamp: 1 })
                .limit(3)
                .lean();

            if (messages.length < 2) {
                this.logger.warn(`Not enough messages to generate title for session ${conversationId}`);
                return 'New Conversation';
            }

            // Take first 3 messages (or all if less than 3)
            const firstMessages = messages.slice(0, 3);

            // Build context string from messages
            const contextParts: string[] = [];
            firstMessages.forEach(msg => {
                const role = msg.role === 'user' ? 'User' : 'Assistant';
                const content = msg.content.substring(0, 200); // Limit each message to 200 chars
                contextParts.push(`${role}: ${content}`);
            });

            const conversationContext = contextParts.join('\n');

            // Call LLM service to generate title
            const generatedTitle = await llmService.generateTitle(conversationContext);

            // Update conversation with new title
            await this.updateTitle(conversationId, userId, generatedTitle);

            // Emit gRPC event for title update (if session is active)
            try {
                // Note: We need to find the ACTIVE session ID for this conversationId to notify the client
                // This might be tricky if conversationId != sessionId. 
                // Ideally SessionCoordinator should support lookup by conversationId.
                // For now, we accept that if IDs differ, real-time title update might not reach the client immediately
                // unless we find the active session. This is an R&D trade-off.
                const sessionCoordinator = (await import('../session/session.coordinator.js')).default;
                const session = sessionCoordinator.getSession(conversationId); // Try using convId as sessionId (legacy/simple case)
                if (session && session.metadata?.grpcCall) {
                    session.metadata.grpcCall.write({
                        title_update: {
                            session_id: conversationId,
                            title: generatedTitle
                        }
                    });
                    this.logger.debug(`Emitted title update via gRPC for session ${conversationId}`);
                }
            } catch (emitError: any) {
                this.logger.warn(`Failed to emit title update via gRPC: ${emitError.message}`);
            }

            this.logger.info(`Successfully generated and updated title for conversation ${conversationId}: "${generatedTitle}"`);

            return generatedTitle;

        } catch (error: any) {
            this.logger.error(`Error generating conversation title for session ${conversationId}: ${error.message}`);
            // Don't throw - just return fallback
            return 'New Conversation';
        }
    }

    /**
     * Ensure conversation exists (create if not)
     */
    /**
     * Ensure conversation exists (create if not)
     */
    async ensureConversation(conversationId: string, userId: string) {
        const exists = await Conversation.exists({ conversationId });
        if (!exists) {
            await Conversation.create({
                userId,
                conversationId,
                title: 'New Conversation',
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }
    }

    /**
     * Create a new conversation explicitly
     */
    /**
     * Create a new conversation explicitly
     */
    async createConversation(userId: string, systemPrompt?: string, model?: string) {
        const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const conversation = await Conversation.create({
            userId,
            conversationId,
            title: 'New Conversation',
            systemPrompt: systemPrompt || "You are Gnani, a helpful AI assistant.",
            currentModel: model, // Will use default from schema if undefined
            createdAt: new Date(),
            updatedAt: new Date()
        });
        return conversation;
    }

    /**
     * Regenerate response with proper generation tracking
     */
    /**
     * Regenerate response with proper generation tracking
     */
    async regenerateResponse(conversationId: string, messageId: string, userId: string) {
        const message = await ConversationMessage.findOne({
            _id: messageId,
            conversationId,
            userId,
            deletedAt: null
        });

        if (!message || message.role !== 'assistant') {
            throw new Error('Message not found or not an assistant message');
        }

        // Find parent user message
        let parentMessage = await ConversationMessage.findById(message.parentMessageId || message.parentId);

        // Fallback: If parent not found by ID, find the latest user message before this assistant message in the same conversation
        if (!parentMessage) {
            console.warn(`[Regenerate] Parent message not found for ${messageId}, attempting temporal fallback...`);
            parentMessage = await ConversationMessage.findOne({
                conversationId,
                role: 'user',
                timestamp: { $lt: message.timestamp },
                deletedAt: null
            }).sort({ timestamp: -1 });

            // If found via fallback, heal the link
            if (parentMessage) {
                console.info(`[Regenerate] Healed parent link for ${messageId} -> ${parentMessage._id}`);
                message.parentMessageId = parentMessage._id.toString();
                await message.save();
            }
        }

        if (!parentMessage) {
            throw new Error('Parent message not found (and fallback failed)');
        }

        // Find max generation index for this parent
        const existingGenerations = await ConversationMessage.find({
            parentMessageId: parentMessage._id.toString(),
            deletedAt: null
        }).sort({ generationIndex: -1 }).limit(1);

        const nextGenerationIndex = existingGenerations.length > 0
            ? existingGenerations[0].generationIndex + 1
            : 0;

        // Fetch conversation details for tracking
        const conversationDoc = await Conversation.findOne({ conversationId }).lean();
        const currentModel = conversationDoc?.currentModel || 'gemma:2b';
        const currentTemplateId = conversationDoc?.currentTemplate;

        // Create new generation record
        const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const generationId = `gen_${parentMessage._id}_${nextGenerationIndex}`;

        // STAGE 1: Validate message before creation
        await validateMessage({
            parentId: parentMessage._id.toString(),
            conversationId,
            role: 'assistant',
            content: '...'
        });

        const newGeneration = await ConversationMessage.create({
            userId,
            conversationId,
            role: 'assistant',
            content: '...', // Initialize with non-empty string to bypass validation
            status: 'pending',
            generationIndex: nextGenerationIndex,
            generationId,
            parentMessageId: parentMessage._id.toString(),
            parentId: parentMessage._id.toString(),
            metadata: {
                regeneratedFrom: messageId,
                model: currentModel,
                template: currentTemplateId
            }
        });

        // Update parent's children array
        await ConversationMessage.findByIdAndUpdate(parentMessage._id, {
            $push: { children: newGeneration.id }
        });

        // Trigger regeneration via SessionCoordinator (Async)
        // We do NOT await this. The response will be streamed via gRPC.
        const ephemSessionId = await this._ensureCoordinatorSession(conversationId, userId);
        sessionCoordinator.processTextInput(ephemSessionId, parentMessage.content, { targetMessageId: newGeneration._id.toString(), skipUserPersistence: true })
            .catch(err => {
                console.error(`Async regeneration failed for session ${ephemSessionId}:`, err);
            });


        // Update message count
        await Conversation.findOneAndUpdate(
            { conversationId },
            { $inc: { messageCount: 1 } } // Assistant response
        );

        // Return the pending message immediately
        return newGeneration;
    }

    /**
     * Helper to ensure session exists in coordinator
     */
    private async _ensureCoordinatorSession(
        conversationId: string,
        userId: string,
        callbacks?: {
            onChunk?: (text: string, messageId?: string) => void | Promise<void>;
            onComplete?: (text: string, messageId?: string) => void | Promise<void>;
        }
    ): Promise<string> {
        // Start a new ephemeral session bound to this conversation
        // This ensures the coordinator can process the request
        const { sessionId } = await sessionCoordinator.startSession(
            userId,
            async (transcript, isFinal) => { /* no-op for REST */ },
            async (text, messageId) => {
                if (callbacks?.onChunk) await callbacks.onChunk(text, messageId);
            },
            async (text, messageId) => {
                if (callbacks?.onComplete) await callbacks.onComplete(text, messageId);
            },
            async (status) => { /* no-op for REST */ },
            undefined, // Generate new ephemeral ID
            conversationId // Bind to persistent conversation ID
        );
        return sessionId;
    }



    /**
     * Send a new message (REST API)
     */
    async sendMessage(
        conversationId: string,
        userId: string,
        content: string,
        callbacks?: {
            onChunk?: (text: string, messageId?: string) => void | Promise<void>;
            onComplete?: (text: string, messageId?: string) => void | Promise<void>;
        },
        model?: string,
        template?: string | null
    ) {
        // Update model if provided
        if (model) {
            await this.updateConversationModel(conversationId, userId, model);
        }

        // Update template if provided (strictly checking against undefined to allow null/empty for clearing)
        if (template !== undefined) {
            await this.updateConversationTemplate(conversationId, userId, template);
        }

        const ephemSessionId = await this._ensureCoordinatorSession(conversationId, userId, callbacks);

        // Process via coordinator
        // Note: this awaits the full generation including LLM response
        await sessionCoordinator.processTextInput(ephemSessionId, content);

        // Fetch the newly created messages (User + Assistant) for this conversation
        // We assume the last 2 messages are the ones we just created
        const messages = await ConversationMessage.find({ conversationId })
            .sort({ timestamp: -1 })
            .limit(2)
            .lean();

        // Return them in chronological order (User, then Assistant)
        return messages.reverse();
    }

    /**
     * Edit message with auto-regeneration (ChatGPT/Gemini style)
     * RESTRICTION: Only user messages can be edited
     */
    async editMessage(
        conversationId: string,
        messageId: string,
        newContent: string,
        userId: string,
        autoRegenerate: boolean = true
    ) {
        const message = await ConversationMessage.findOne({
            _id: messageId,
            conversationId,
            userId,
            deletedAt: null
        });

        if (!message) {
            throw new Error('Message not found or already deleted');
        }

        // RESTRICTION: Only allow editing user messages
        if (message.role !== 'user') {
            throw new Error('Cannot edit assistant messages. Only user messages can be edited.');
        }

        // Save to edit history
        const editHistory = message.editHistory || [];
        editHistory.push({
            version: message.version,
            content: message.content,
            editedAt: new Date(),
            editedBy: userId
        });

        // Update message content
        const originalTimestamp = message.timestamp;
        message.content = newContent;
        message.version += 1;
        message.editHistory = editHistory;
        await message.save();

        // Find and soft delete old responses
        const oldResponses = await ConversationMessage.find({
            parentMessageId: messageId,
            role: 'assistant',
            deletedAt: null
        });

        const oldResponseIds = oldResponses.map(r => r._id.toString());

        if (oldResponseIds.length > 0) {
            await ConversationMessage.updateMany(
                { _id: { $in: oldResponseIds } },
                {
                    $set: {
                        deletedAt: new Date(),
                        deletedBy: userId,
                        deletionReason: 'User message edited'
                    }
                }
            );
        }

        let newResponse: any = undefined;

        // Auto-regenerate response (like ChatGPT/Gemini)
        if (autoRegenerate) {
            const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const generationId = `gen_${messageId}_0`;

            // STAGE 1: Validate message before creation
            await validateMessage({
                parentId: messageId,
                conversationId,
                role: 'assistant',
                content: ' '
            });

            // Create new response with status 'pending'
            newResponse = await ConversationMessage.create({
                userId,
                conversationId,
                role: 'assistant',
                content: ' ', // Initialize with a space to bypass "required" validation
                status: 'pending',
                generationIndex: 0,
                generationId,
                parentMessageId: messageId,
                parentId: messageId,
                timestamp: new Date(originalTimestamp.getTime() + 1),
                metadata: {
                    regeneratedAfterEdit: true,
                    editedMessageVersion: message.version,
                    model: 'gemma:2b' // Default
                }
            });

            // Update parent's (user message) children array
            await ConversationMessage.findByIdAndUpdate(messageId, {
                $push: { children: newResponse.id }
            });

            // Trigger regeneration via SessionCoordinator (Async)
            // We do NOT await this. The response will be streamed via gRPC.
            const ephemSessionId = await this._ensureCoordinatorSession(conversationId, userId);
            sessionCoordinator.processTextInput(ephemSessionId, newContent, { targetMessageId: newResponse._id.toString(), skipUserPersistence: true })
                .catch(err => {
                    console.error(`Async edit regeneration failed for session ${ephemSessionId}:`, err);
                });

            // Return pending response immediately
            // newResponse is already the pending document we created above/fetched

            // Update message count - new response added, old ones deleted
            // Net change = 1 (new response) - oldResponseIds.length
            const netChange = 1 - oldResponseIds.length;
            if (netChange !== 0) {
                await Conversation.findOneAndUpdate(
                    { conversationId },
                    { $inc: { messageCount: netChange } }
                );
            }
        } else if (oldResponseIds.length > 0) {
            // Just deletions
            await Conversation.findOneAndUpdate(
                { conversationId },
                { $inc: { messageCount: -oldResponseIds.length } }
            );
        }

        // Build message ordering sequence
        const allMessages = await ConversationMessage.find({
            conversationId,
            deletedAt: null
        }).sort({ timestamp: 1 });

        const ordering = {
            sequence: allMessages.map(m => m._id.toString())
        };

        return {
            editedMessage: message,
            oldResponses: {
                action: 'soft_deleted',
                count: oldResponseIds.length,
                ids: oldResponseIds
            },
            newResponse,
            ordering
        };
    }
    async getMessageGenerations(conversationId: string, messageId: string, userId: string) {
        const message = await ConversationMessage.findOne({
            _id: messageId,
            conversationId,
            userId,
            deletedAt: null
        });

        if (!message) {
            throw new Error('Message not found');
        }

        // Get parent message ID (either this message or its parent)
        const parentId = message.role === 'user' ? message._id.toString() : message.parentMessageId;

        if (!parentId) {
            throw new Error('Cannot find parent message');
        }

        // Find all generations for this parent
        const generations = await ConversationMessage.find({
            parentMessageId: parentId,
            role: 'assistant',
            deletedAt: null
        }).sort({ generationIndex: 1 }).lean();

        return {
            parentMessageId: parentId,
            generations: generations.map(g => ({
                id: g._id.toString(),
                content: g.content,
                generationIndex: g.generationIndex,
                generationId: g.generationId,
                timestamp: g.timestamp,
                tokenUsage: g.tokenUsage
            })),
            totalGenerations: generations.length
        };
    }

    /**
     * Soft delete message and cascade to responses
     * RESTRICTION: Only user messages can be deleted
     */
    async deleteMessage(
        conversationId: string,
        messageId: string,
        userId: string
    ): Promise<{
        deletedCount: number;
        cascadedResponses: number;
        undoToken: string;
        undoExpiresAt: Date;
    }> {
        const message = await ConversationMessage.findOne({
            _id: messageId,
            conversationId,
            userId,
            deletedAt: null
        });

        if (!message) {
            throw new Error('Message not found or already deleted');
        }

        // RESTRICTION: Only allow deleting user messages
        if (message.role !== 'user') {
            throw new Error('Cannot delete assistant messages directly. Delete the parent user message to remove responses.');
        }

        // Find all assistant responses to this user message
        const responses = await ConversationMessage.find({
            parentMessageId: messageId,
            role: 'assistant',
            deletedAt: null
        });

        const responseIds = responses.map(r => r._id.toString());
        const allIds = [messageId, ...responseIds];

        // Cancel any active streams in the responses
        for (const response of responses) {
            if (response.streamState?.streamId && response.status === 'streaming') {
                // Note: Stream cancellation will be handled by SessionCoordinator
                this.logger.info(`Cancelling stream for response ${response._id}`);
            }
        }

        // Soft delete user message + all responses
        const deletedAt = new Date();
        await ConversationMessage.updateMany(
            { _id: { $in: allIds } },
            {
                $set: {
                    deletedAt,
                    deletedBy: userId,
                    status: 'cancelled'
                }
            }
        );

        // Create undo token (stored in memory for now, could use Redis)
        const undoToken = `undo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const undoExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

        // Store undo data in message metadata temporarily
        // In production, this should use Redis
        await ConversationMessage.findByIdAndUpdate(messageId, {
            $set: {
                'metadata.undoToken': undoToken,
                'metadata.undoExpiresAt': undoExpiresAt
            }
        });

        this.logger.info('Message deleted', {
            messageId,
            role: 'user',
            cascadedResponses: responseIds.length,
            undoToken
        });

        // Update message count
        await Conversation.findOneAndUpdate(
            { conversationId },
            { $inc: { messageCount: -allIds.length } }
        );

        return {
            deletedCount: allIds.length,
            cascadedResponses: responseIds.length,
            undoToken,
            undoExpiresAt
        };
    }

    /**
     * Restore deleted message (undo)
     */
    async restoreMessage(
        messageId: string,
        undoToken: string,
        userId: string
    ): Promise<{ restoredCount: number }> {
        // Verify undo token
        const message = await ConversationMessage.findOne({
            _id: messageId,
            userId,
            'metadata.undoToken': undoToken
        });

        if (!message) {
            throw new Error('Undo token expired or invalid');
        }

        const undoExpiresAt = message.metadata?.undoExpiresAt;
        if (!undoExpiresAt || new Date() > new Date(undoExpiresAt)) {
            throw new Error('Undo window expired');
        }

        // Find all messages that were deleted together
        const deletedAt = message.deletedAt;
        const messagesToRestore = await ConversationMessage.find({
            conversationId: message.conversationId,
            deletedAt,
            deletedBy: userId
        });

        const messageIds = messagesToRestore.map(m => m._id);

        // Restore all messages
        await ConversationMessage.updateMany(
            { _id: { $in: messageIds } },
            {
                $unset: {
                    deletedAt: '',
                    deletedBy: ''
                },
                $set: {
                    status: 'completed'
                }
            }
        );

        this.logger.info('Messages restored', {
            messageId,
            restoredCount: messageIds.length
        });

        // Update message count
        await Conversation.findOneAndUpdate(
            { conversationId: message.conversationId },
            { $inc: { messageCount: messageIds.length } }
        );

        return { restoredCount: messageIds.length };
    }

    // STAGE 2: Undo/Restore methods
    async restoreDeletedMessage(conversationId: string, message: any, userId: string) {
        // Restore a deleted message
        const restoredMessage = await ConversationMessage.create({
            ...message,
            userId,
            conversationId,
            deletedAt: null,
            deletedBy: null
        });



        // Update message count
        await Conversation.findOneAndUpdate(
            { conversationId },
            { $inc: { messageCount: 1 } }
        );

        return restoredMessage;
    }

    async updateMessageContent(conversationId: string, messageId: string, content: string, userId: string) {
        // Update message content (for undo edit)
        const message = await ConversationMessage.findOneAndUpdate(
            { _id: messageId, conversationId, userId, deletedAt: null },
            { content },
            { new: true }
        );

        if (!message) {
            throw new Error('Message not found');
        }

        return message;
    }

    async restoreGeneration(conversationId: string, messageId: string, previousMessage: any, userId: string) {
        // Restore previous generation (for undo regenerate)
        // Delete the current message and restore the previous one
        await ConversationMessage.findOneAndUpdate(
            { _id: messageId, conversationId, userId },
            { deletedAt: new Date(), deletedBy: userId }
        );

        // Restore previous message
        const restoredMessage = await ConversationMessage.create({
            ...previousMessage,
            userId,
            conversationId,
            deletedAt: null
        });

        return restoredMessage;
    }
    async shareConversation(conversationId: string, userId: string, expiresIn?: number) {
        // Find conversation
        const conversation = await Conversation.findOne({ conversationId, userId });
        if (!conversation) {
            throw new Error('Conversation not found');
        }

        // Generate or retrieve share ID
        let shareId = conversation.shareId;
        if (!shareId) {
            // Generate a secure random string for sharing
            shareId = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
        }

        // Calculate expiration date
        let shareExpiresAt: Date | undefined;
        if (expiresIn) {
            shareExpiresAt = new Date(Date.now() + expiresIn * 1000);
        }

        // Update conversation with share details
        await Conversation.findOneAndUpdate(
            { conversationId },
            {
                $set: {
                    shareId,
                    shareExpiresAt
                }
            }
        );

        return {
            shareId,
            shareUrl: `${process.env.APP_URL || 'http://localhost:5173'}/share/${shareId}`,
            expiresAt: shareExpiresAt
        };
    }
}

export default new ConversationService();
