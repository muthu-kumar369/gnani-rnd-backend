// src/modules/memory/services/long-term-memory.service.ts
import { createContextualLogger } from '../../../core/logger/logger.js';
import ConversationSummary, { IConversationSummary } from '../entities/conversation-summary.entity.js';
import { IConversationMessage } from '../entities/conversation.entity.js';
import vectorManager from '../../vector/vector.manager.js';
import llmService from '../../llm/llm.service.js';
import { Logger } from 'winston';
import { v4 as uuidv4 } from 'uuid';

class LongTermMemoryService {
    private logger: Logger;

    constructor() {
        this.logger = createContextualLogger({ module: 'LongTermMemoryService' });
        this.logger.info('LongTermMemoryService initialized.');
    }

    /**
     * Summarize a batch of conversation messages using LLM
     */
    async summarizeConversation(messages: IConversationMessage[]): Promise<string> {
        if (messages.length === 0) {
            return '';
        }

        try {
            // Build conversation text
            const conversationText = messages.map(msg =>
                `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
            ).join('\n');

            // Create summarization prompt
            const summaryPrompt = {
                system_message: `You are a conversation summarizer. Create a concise summary of the following conversation, highlighting key topics, decisions, and important information. Keep the summary under 200 words.`,
                conversation_history: [],
                current_user_query: conversationText,
                classified_intent: 'summarization',
                user_settings: '{}',
                user_preferences: '{}',
                user_roles: ['user'],
                user_permissions: [],
                session_id: 'summarization',
                user_id: messages[0].userId,
                long_term_context: '',
                action_directives_guide: ''
            };

            const response = await llmService.getLlmResponse(summaryPrompt, null);
            this.logger.debug(`Generated summary for ${messages.length} messages`);
            return response.text;
        } catch (error: any) {
            this.logger.error(`Error summarizing conversation: ${error.message}`);
            // Fallback to simple concatenation
            return messages.slice(0, 5).map(m => m.content).join('. ');
        }
    }

    /**
     * Extract topics from messages
     */
    private extractTopics(messages: IConversationMessage[]): string[] {
        const topics = new Set<string>();

        messages.forEach(msg => {
            if (msg.metadata?.intent) {
                topics.add(msg.metadata.intent);
            }
        });

        return Array.from(topics);
    }

    /**
     * Create and store a conversation summary
     */
    async createSummary(
        userId: string,
        messages: IConversationMessage[]
    ): Promise<IConversationSummary | null> {
        if (messages.length === 0) {
            return null;
        }

        try {
            const summary = await this.summarizeConversation(messages);
            const conversationIds = [...new Set(messages.map(m => m.conversationId))];
            const topics = this.extractTopics(messages);

            const conversationSummary = new ConversationSummary({
                userId,
                conversationIds,
                summary,
                messageCount: messages.length,
                startTime: messages[0].timestamp,
                endTime: messages[messages.length - 1].timestamp,
                topics,
                embeddingStatus: 'pending',
                metadata: {
                    intents: topics,
                    messageIds: messages.map(m => m._id)
                }
            });

            await conversationSummary.save();
            this.logger.info(`Created summary for ${messages.length} messages`);
            return conversationSummary;
        } catch (error: any) {
            this.logger.error(`Error creating summary: ${error.message}`);
            return null;
        }
    }

    /**
     * Store summary embedding in ChromaDB
     */
    async storeEmbedding(
        summaryId: string,
        userId: string,
        summaryText: string,
        metadata: any = {}
    ): Promise<boolean> {
        try {
            const embeddingId = `summary_${summaryId}_${uuidv4()}`;

            await vectorManager.addEmbedding(
                userId,
                embeddingId,
                summaryText,
                {
                    ...metadata,
                    summaryId,
                    type: 'conversation_summary'
                }
            );

            // Update summary with embedding ID
            await ConversationSummary.findByIdAndUpdate(summaryId, {
                embeddingId,
                embeddingStatus: 'completed'
            });

            this.logger.info(`Stored embedding for summary ${summaryId}`);
            return true;
        } catch (error: any) {
            this.logger.error(`Error storing embedding: ${error.message}`);

            // Update status to failed
            await ConversationSummary.findByIdAndUpdate(summaryId, {
                embeddingStatus: 'failed'
            });

            return false;
        }
    }

    /**
     * Retrieve relevant long-term memories using semantic search
     */
    async retrieveRelevantMemories(
        userId: string,
        query: string,
        topK: number = 5
    ): Promise<string[]> {
        try {
            const relevantEmbeddings = await vectorManager.getRelevantEmbeddings(
                userId,
                query,
                topK
            );

            this.logger.debug(`Retrieved ${relevantEmbeddings.length} relevant memories`);
            return relevantEmbeddings;
        } catch (error: any) {
            this.logger.error(`Error retrieving relevant memories: ${error.message}`);
            return [];
        }
    }

    /**
     * Process old conversations for summarization and embedding
     */
    async processOldConversations(
        userId: string,
        messages: IConversationMessage[]
    ): Promise<void> {
        if (messages.length === 0) {
            return;
        }

        try {
            // Group messages by conversation window (e.g., per day or per session)
            const conversationGroups = this.groupMessagesByConversation(messages);

            for (const group of conversationGroups) {
                // Create summary
                const summary = await this.createSummary(userId, group);

                if (summary) {
                    // Store embedding
                    await this.storeEmbedding(
                        summary._id.toString(),
                        userId,
                        summary.summary,
                        {
                            topics: summary.topics,
                            messageCount: summary.messageCount,
                            startTime: summary.startTime,
                            endTime: summary.endTime
                        }
                    );
                }
            }

            this.logger.info(`Processed ${conversationGroups.length} conversation groups for user ${userId}`);
        } catch (error: any) {
            this.logger.error(`Error processing old conversations: ${error.message}`);
        }
    }

    /**
     * Group messages by conversation for summarization
     */
    private groupMessagesByConversation(messages: IConversationMessage[]): IConversationMessage[][] {
        const conversationMap = new Map<string, IConversationMessage[]>();

        messages.forEach(msg => {
            if (!conversationMap.has(msg.conversationId)) {
                conversationMap.set(msg.conversationId, []);
            }
            conversationMap.get(msg.conversationId)!.push(msg);
        });

        return Array.from(conversationMap.values());
    }

    /**
     * Get pending summaries that need embedding
     */
    async getPendingSummaries(limit: number = 10): Promise<IConversationSummary[]> {
        try {
            const summaries = await ConversationSummary
                .find({ embeddingStatus: 'pending' })
                .limit(limit)
                .lean()
                .exec();

            return summaries as unknown as IConversationSummary[];
        } catch (error: any) {
            this.logger.error(`Error getting pending summaries: ${error.message}`);
            return [];
        }
    }
}

export default new LongTermMemoryService();
