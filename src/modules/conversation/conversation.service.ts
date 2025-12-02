import Conversation, { IConversation } from './conversation.model.js';
import ConversationMessage from '../memory/entities/conversation.entity.js';
import llmService from '../llm/llm.service.js';
import { Types } from 'mongoose';

interface PaginationOptions {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

class ConversationService {
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
     * Soft delete conversation
     */
    async deleteConversation(sessionId: string, userId: string) {
        return Conversation.findOneAndUpdate(
            { sessionId, userId },
            { isDeleted: true },
            { new: true }
        );
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

        // Generate new response
        // We need to reconstruct the prompt context. For simplicity, we'll just use the parent message for now,
        // but ideally we should rebuild the history up to that point.
        // TODO: Rebuild full history context for regeneration
        
        const prompt = {
            session_id: sessionId,
            user_id: userId,
            system_message: "You are Gnani, a helpful AI assistant.", // Should get from config or context
            current_user_query: parentMessage.content,
            conversation_history: [], // Should fetch history
            classified_intent: 'general_query'
        };

        const response = await llmService.getLlmResponse(prompt);

        // Create new sibling message
        const newMessage = await ConversationMessage.create({
            userId,
            sessionId,
            role: 'assistant',
            content: response.text,
            parentId: message.parentId,
            branchIndex: (message.branchIndex || 0) + 1,
            metadata: {
                ...message.metadata,
                regeneratedFrom: messageId
            }
        });

        // Update parent's children
        parentMessage.children = parentMessage.children || [];
        parentMessage.children.push(newMessage._id.toString());
        await parentMessage.save();

        return newMessage;
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

        // Generate new assistant response
        const prompt = {
            session_id: sessionId,
            user_id: userId,
            system_message: "You are Gnani, a helpful AI assistant.",
            current_user_query: newContent,
            conversation_history: [], // Should fetch history
            classified_intent: 'general_query'
        };

        const response = await llmService.getLlmResponse(prompt);

        const newAssistantMessage = await ConversationMessage.create({
            userId,
            sessionId,
            role: 'assistant',
            content: response.text,
            parentId: newUserMessage._id.toString(),
            branchIndex: 0, // First response in this new branch
            metadata: {
                intent: 'general_query'
            }
        });

        newUserMessage.children = [newAssistantMessage._id.toString()];
        await newUserMessage.save();

        return { newUserMessage, newAssistantMessage };
    }
}

export default new ConversationService();
