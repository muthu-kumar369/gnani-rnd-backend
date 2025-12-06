import Conversation, { IConversation } from './conversation.model.js';
import ConversationMessage from '../memory/entities/conversation.entity.js';
import llmService from '../llm/llm.service.js';
import shortTermMemory from '../memory/services/short-term-memory.service.js';
import { createContextualLogger } from '../../core/logger/logger.js';
import { Types } from 'mongoose';
import sessionCoordinator from '../session/session.coordinator.js';

interface PaginationOptions {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

class ConversationService {
    private logger = createContextualLogger({ module: 'ConversationService' });
    /**
     * List conversations for a user
     */
    async listConversations(userId: string, options: PaginationOptions = {}) {
        const page = Math.max(1, options.page || 1);
        const limit = Math.max(1, Math.min(50, options.limit || 20));
        const skip = (page - 1) * limit;

        const sort: any = {};
        const sortBy = options.sortBy || 'updatedAt';
        const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
        sort[sortBy] = sortOrder;

        const query = { userId, isDeleted: false };

        const [conversations, total] = await Promise.all([
            Conversation.find(query)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),
            Conversation.countDocuments(query)
        ]);

        // Fetch preview (last message) for each conversation
        const conversationsWithPreview = await Promise.all(conversations.map(async (conv) => {
            const lastMessage = await ConversationMessage.findOne({ sessionId: conv.sessionId })
                .sort({ timestamp: -1 })
                .select('content timestamp')
                .lean();

            return {
                ...conv,
                id: conv._id,
                preview: lastMessage ? lastMessage.content.substring(0, 100) : '',
                lastMessageAt: lastMessage ? lastMessage.timestamp : conv.updatedAt
            };
        }));

        return {
            conversations: conversationsWithPreview,
            total,
            page,
            limit,
            hasMore: total > skip + limit
        };
    }

    /**
     * Get full conversation details with messages
     */
    async getConversation(sessionId: string, userId: string) {
        const conversation = await Conversation.findOne({ sessionId, userId, isDeleted: false }).lean();

        if (!conversation) {
            return null;
        }

        const messages = await ConversationMessage.find({ sessionId })
            .sort({ timestamp: 1 })
            .lean();

        return {
            ...conversation,
            id: conversation._id,
            messages: messages.map(msg => ({
                id: msg._id,
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp,
                parentId: msg.parentId,
                children: msg.children,
                branchIndex: msg.branchIndex,
                metadata: msg.metadata
            }))
        };
    }

    /**
     * Search conversations
     */
    async searchConversations(userId: string, query: string, limit: number = 10) {
        // 1. Search in Conversation titles
        const titleMatches = await Conversation.find({
            userId,
            isDeleted: false,
            $text: { $search: query }
        }).limit(limit).lean();

        // 2. Search in Messages
        const messageMatches = await ConversationMessage.find({
            userId,
            $text: { $search: query }
        }).limit(limit * 2).select('sessionId content').lean();

        // Extract unique session IDs from message matches
        const sessionIdsFromMessages = [...new Set(messageMatches.map(m => m.sessionId))];

        // Fetch conversations for message matches (if not already found by title)
        const titleMatchIds = new Set(titleMatches.map(c => c.sessionId));
        const newSessionIds = sessionIdsFromMessages.filter(sid => !titleMatchIds.has(sid));

        const messageMatchConversations = await Conversation.find({
            sessionId: { $in: newSessionIds },
            userId,
            isDeleted: false
        }).limit(limit - titleMatches.length).lean();

        const allConversations = [...titleMatches, ...messageMatchConversations];

        // Add snippets
        return allConversations.map(conv => {
            const matchingMsg = messageMatches.find(m => m.sessionId === conv.sessionId);
            return {
                ...conv,
                id: conv._id,
                matchType: titleMatchIds.has(conv.sessionId) ? 'title' : 'content',
                snippet: matchingMsg ? matchingMsg.content.substring(0, 150) : ''
            };
        });
    }

    /**
     * Soft delete conversation and cleanup associated files
     */
    async deleteConversation(sessionId: string, userId: string) {
        try {
            // Get all messages with attachments
            const messages = await ConversationMessage.find({ sessionId, userId });

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
            return Conversation.findOneAndUpdate(
                { sessionId, userId },
                { isDeleted: true },
                { new: true }
            );
        } catch (error: any) {
            console.error('Error deleting conversation:', error);
            throw error;
        }
    }

    /**
     * Update conversation title
     */
    async updateTitle(sessionId: string, userId: string, title: string) {
        return Conversation.findOneAndUpdate(
            { sessionId, userId },
            { title },
            { new: true }
        );
    }

    /**
     * Update conversation system prompt
     */
    async updateSystemPrompt(sessionId: string, userId: string, systemPrompt: string) {
        return Conversation.findOneAndUpdate(
            { sessionId, userId, isDeleted: false },
            { systemPrompt },
            { new: true }
        );
    }

    /**
     * Update conversation template
     */
    async updateConversationTemplate(sessionId: string, userId: string, templateId: string) {
        return Conversation.findOneAndUpdate(
            { sessionId, userId, isDeleted: false },
            { currentTemplate: templateId },
            { new: true }
        );
    }

    /**
     * Update conversation model
     */
    async updateConversationModel(sessionId: string, userId: string, modelId: string) {
        return Conversation.findOneAndUpdate(
            { sessionId, userId, isDeleted: false },
            { currentModel: modelId },
            { new: true }
        );
    }

    /**
     * Generate conversation title based on first 2-3 messages
     * @param sessionId - Session ID of the conversation
     * @param userId - User ID
     * @returns Promise<string> - Generated title
     */
    async generateConversationTitle(sessionId: string, userId: string): Promise<string> {
        try {
            this.logger.info(`Generating title for conversation ${sessionId}`);

            // Fetch first 3 messages from the conversation
            const messages = await shortTermMemory.getSessionMessages(sessionId);

            if (messages.length < 2) {
                this.logger.warn(`Not enough messages to generate title for session ${sessionId}`);
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
            await this.updateTitle(sessionId, userId, generatedTitle);

            // Emit gRPC event for title update
            try {
                const sessionCoordinator = (await import('../session/session.coordinator.js')).default;
                const session = sessionCoordinator.getSession(sessionId);
                if (session && session.metadata?.grpcCall) {
                    session.metadata.grpcCall.write({
                        title_update: {
                            session_id: sessionId,
                            title: generatedTitle
                        }
                    });
                    this.logger.debug(`Emitted title update via gRPC for session ${sessionId}`);
                }
            } catch (emitError: any) {
                this.logger.warn(`Failed to emit title update via gRPC: ${emitError.message}`);
            }

            this.logger.info(`Successfully generated and updated title for session ${sessionId}: "${generatedTitle}"`);

            return generatedTitle;

        } catch (error: any) {
            this.logger.error(`Error generating conversation title for session ${sessionId}: ${error.message}`);
            // Don't throw - just return fallback
            return 'New Conversation';
        }
    }

    /**
     * Ensure conversation exists (create if not)
     */
    async ensureConversation(sessionId: string, userId: string) {
        const exists = await Conversation.exists({ sessionId });
        if (!exists) {
            await Conversation.create({
                userId,
                sessionId,
                title: 'New Conversation',
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }
    }

    /**
     * Create a new conversation explicitly
     */
    async createConversation(userId: string, systemPrompt?: string) {
        const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const conversation = await Conversation.create({
            userId,
            sessionId,
            title: 'New Conversation',
            systemPrompt: systemPrompt || "You are Gnani, a helpful AI assistant.",
            createdAt: new Date(),
            updatedAt: new Date()
        });
        return conversation;
    }

    /**
     * Regenerate response with proper generation tracking
     */
    async regenerateResponse(sessionId: string, messageId: string, userId: string) {
        const message = await ConversationMessage.findOne({
            _id: messageId,
            sessionId,
            userId,
            deletedAt: null
        });

        if (!message || message.role !== 'assistant') {
            throw new Error('Message not found or not an assistant message');
        }

        // Find parent user message
        const parentMessage = await ConversationMessage.findById(message.parentMessageId || message.parentId);
        if (!parentMessage) {
            throw new Error('Parent message not found');
        }

        // Find max generation index for this parent
        const existingGenerations = await ConversationMessage.find({
            parentMessageId: parentMessage._id.toString(),
            deletedAt: null
        }).sort({ generationIndex: -1 }).limit(1);

        const nextGenerationIndex = existingGenerations.length > 0
            ? existingGenerations[0].generationIndex + 1
            : 0;

        // Create new generation record
        const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const generationId = `gen_${parentMessage._id}_${nextGenerationIndex}`;

        const newGeneration = await ConversationMessage.create({
            userId,
            sessionId,
            role: 'assistant',
            content: '',
            status: 'pending',
            generationIndex: nextGenerationIndex,
            generationId,
            parentMessageId: parentMessage._id.toString(),
            parentId: parentMessage._id.toString(),
            metadata: {
                regeneratedFrom: messageId
            }
        });

        // Trigger regeneration via SessionCoordinator
        await this._ensureCoordinatorSession(sessionId, userId);
        const result = await sessionCoordinator.processTextInput(sessionId, parentMessage.content);

        // Fetch the updated message
        const updatedGeneration = await ConversationMessage.findById(newGeneration._id);

        return updatedGeneration;
    }

    /**
     * Helper to ensure session exists in coordinator
     */
    private async _ensureCoordinatorSession(sessionId: string, userId: string) {
        if (!sessionCoordinator.getSession(sessionId)) {
            // Start a session with dummy callbacks since we await the result directly
            await sessionCoordinator.startSession(
                userId,
                async (transcript, isFinal) => { /* no-op for REST */ },
                async (text) => { /* no-op for REST */ },
                async (text) => { /* no-op for REST */ },
                async (status) => { /* no-op for REST */ },
                sessionId,
                sessionId // Pass sessionId as conversationId for REST operations to ensure persistence consistency
            );
        }
    }

    /**
     * Send a new message (REST API)
     */
    async sendMessage(sessionId: string, userId: string, content: string) {
        await this._ensureCoordinatorSession(sessionId, userId);

        // Process via coordinator
        const result = await sessionCoordinator.processTextInput(sessionId, content);

        // Fetch the newly created messages (User + Assistant)
        // We assume the last 2 messages are the ones we just created
        const messages = await ConversationMessage.find({ sessionId })
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
        sessionId: string,
        messageId: string,
        newContent: string,
        userId: string,
        autoRegenerate: boolean = true
    ) {
        const message = await ConversationMessage.findOne({
            _id: messageId,
            sessionId,
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

            // Create new response with status 'pending'
            newResponse = await ConversationMessage.create({
                userId,
                sessionId,
                role: 'assistant',
                content: '',
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

            // Trigger regeneration via SessionCoordinator
            await this._ensureCoordinatorSession(sessionId, userId);

            // Pass the placeholder ID so coordinator updates it instead of creating a duplicate
            await sessionCoordinator.processTextInput(sessionId, newContent, { targetMessageId: newResponse._id as string });

            // Fetch updated response
            newResponse = await ConversationMessage.findById(newResponse._id);
        }

        // Build message ordering sequence
        const allMessages = await ConversationMessage.find({
            sessionId,
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
    async getMessageGenerations(sessionId: string, messageId: string, userId: string) {
        const message = await ConversationMessage.findOne({
            _id: messageId,
            sessionId,
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
        sessionId: string,
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
            sessionId,
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
            sessionId: message.sessionId,
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

        return { restoredCount: messageIds.length };
    }
}

export default new ConversationService();
