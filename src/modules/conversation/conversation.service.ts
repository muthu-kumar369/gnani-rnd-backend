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
     * Regenerate the last assistant response
     */
    async regenerateResponse(sessionId: string, messageId: string, userId: string) {
        const message = await ConversationMessage.findOne({ _id: messageId, sessionId, userId });
        if (!message || message.role !== 'assistant') {
            throw new Error('Message not found or not an assistant message');
        }

        const parentMessage = await ConversationMessage.findOne({ _id: message.parentId, sessionId, userId });
        if (!parentMessage) {
            throw new Error('Parent message not found');
        }

        // Generate new response via SessionCoordinator
        // This ensures consistent RAG, Tool Execution, and Context management
        await this._ensureCoordinatorSession(sessionId, userId);
        
        // We pass the parent message content as if it were a new input, 
        // but the coordinator handles it as a "text input" event.
        // Note: Ideally, we should have a specific "regenerate" method in coordinator,
        // but processTextInput is a reasonable proxy for now as it triggers the full pipeline.
        const result = await sessionCoordinator.processTextInput(sessionId, parentMessage.content);

        // The coordinator saves the message to DB, but we need to return it here.
        // Since coordinator saves it, we fetch the latest assistant message.
        const newMessage = await ConversationMessage.findOne({ sessionId, role: 'assistant' })
            .sort({ timestamp: -1 })
            .lean();

        if (!newMessage) {
             throw new Error('Failed to generate new response');
        }

        // Update parent's children if not already linked (coordinator might handle this differently, 
        // but let's ensure linkage)
        if (!parentMessage.children?.includes(newMessage._id.toString())) {
             parentMessage.children = parentMessage.children || [];
             parentMessage.children.push(newMessage._id.toString());
             await parentMessage.save();
        }
        
        // Update metadata to link to original message
        await ConversationMessage.findByIdAndUpdate(newMessage._id, {
            $set: {
                parentId: message.parentId,
                branchIndex: (message.branchIndex || 0) + 1,
                metadata: {
                    ...newMessage.metadata,
                    regeneratedFrom: messageId
                }
            }
        });

        return newMessage;
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
                async (status) => { /* no-op for REST */ },
                sessionId
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
     * Edit a user message and branch the conversation
     */
    async editMessage(sessionId: string, messageId: string, newContent: string, userId: string) {
        const originalMessage = await ConversationMessage.findOne({ _id: messageId, sessionId, userId });
        if (!originalMessage || originalMessage.role !== 'user') {
            throw new Error('Message not found or not a user message');
        }

        // Create new user message as sibling
        const newUserMessage = await ConversationMessage.create({
            userId,
            sessionId,
            role: 'user',
            content: newContent,
            parentId: originalMessage.parentId,
            branchIndex: (originalMessage.branchIndex || 0) + 1,
            metadata: {
                ...originalMessage.metadata,
                editedFrom: messageId
            }
        });

        if (originalMessage.parentId) {
            const parent = await ConversationMessage.findById(originalMessage.parentId);
            if (parent) {
                parent.children = parent.children || [];
                parent.children.push(newUserMessage._id.toString());
                await parent.save();
            }
        }

        // Generate new assistant response via SessionCoordinator
        await this._ensureCoordinatorSession(sessionId, userId);
        const result = await sessionCoordinator.processTextInput(sessionId, newContent);

        // Fetch the latest assistant message
        const newAssistantMessage = await ConversationMessage.findOne({ sessionId, role: 'assistant' })
            .sort({ timestamp: -1 })
            .lean();

        if (!newAssistantMessage) {
            throw new Error('Failed to generate response for edited message');
        }

        // Link assistant message to the new user message
        // Note: Coordinator creates messages independently, so we need to fix the parentId
        await ConversationMessage.findByIdAndUpdate(newAssistantMessage._id, {
            parentId: newUserMessage._id.toString(),
            branchIndex: 0
        });

        newUserMessage.children = [newAssistantMessage._id.toString()];
        await newUserMessage.save();

        return { newUserMessage, newAssistantMessage };
    }
    /**
     * Delete a message and all its descendants
     */
    async deleteMessage(sessionId: string, messageId: string, userId: string) {
        const message = await ConversationMessage.findOne({ _id: messageId, sessionId, userId });
        if (!message) {
            throw new Error('Message not found');
        }

        // 1. Find all descendants
        const descendants: string[] = [];
        const queue: string[] = [messageId];

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            descendants.push(currentId);

            const currentMsg = await ConversationMessage.findById(currentId);
            if (currentMsg && currentMsg.children && currentMsg.children.length > 0) {
                queue.push(...currentMsg.children);
            }
        }

        // 2. Delete all descendants (including the message itself)
        await ConversationMessage.deleteMany({ _id: { $in: descendants } });

        // 3. Update parent's children array
        if (message.parentId) {
            await ConversationMessage.updateOne(
                { _id: message.parentId },
                { $pull: { children: messageId } }
            );
        }

        return { deletedCount: descendants.length, deletedIds: descendants };
    }
}

export default new ConversationService();
