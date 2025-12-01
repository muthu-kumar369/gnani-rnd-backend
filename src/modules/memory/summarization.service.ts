// src/modules/memory/summarization.service.ts
import { createContextualLogger } from '../../core/logger/logger.js';
import { Logger } from 'winston';
import llmService from '../llm/llm.service.js';

export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: number;
}

export interface SummarizationResult {
    summary: string;
    messageCount: number;
    compressionRatio: number;
    timestamp: number;
}

export interface SummarizationConfig {
    triggerThreshold: number;      // Number of messages before summarization
    minMessagesToSummarize: number; // Minimum messages to include in summary
    keepRecentCount: number;        // Number of recent messages to keep unsummarized
}

class SummarizationService {
    private logger: Logger;
    private config: SummarizationConfig;

    constructor() {
        this.logger = createContextualLogger({ module: 'SummarizationService' });

        // Default configuration
        this.config = {
            triggerThreshold: parseInt(process.env.SUMMARIZATION_TRIGGER_THRESHOLD || '20'),
            minMessagesToSummarize: parseInt(process.env.SUMMARIZATION_MIN_MESSAGES || '10'),
            keepRecentCount: parseInt(process.env.SUMMARIZATION_KEEP_RECENT || '5')
        };

        this.logger.info('SummarizationService initialized', this.config);
    }

    /**
     * Check if conversation needs summarization
     */
    needsSummarization(messageCount: number): boolean {
        return messageCount >= this.config.triggerThreshold;
    }

    /**
     * Summarize a conversation history
     */
    async summarizeConversation(
        messages: ConversationMessage[],
        userId: string,
        sessionId: string
    ): Promise<SummarizationResult> {
        const startTime = Date.now();

        if (messages.length < this.config.minMessagesToSummarize) {
            this.logger.warn(`Not enough messages to summarize (${messages.length} < ${this.config.minMessagesToSummarize})`);
            throw new Error('Insufficient messages for summarization');
        }

        // Split messages into: to-summarize and keep-recent
        const messagesToSummarize = messages.slice(0, -this.config.keepRecentCount);
        const recentMessages = messages.slice(-this.config.keepRecentCount);

        this.logger.info(`Summarizing ${messagesToSummarize.length} messages, keeping ${recentMessages.length} recent`);

        // Build summarization prompt
        const conversationText = this.formatMessagesForSummarization(messagesToSummarize);
        const summaryPrompt = this.buildSummarizationPrompt(conversationText);

        try {
            // Call LLM for summarization
            const llmResponse = await llmService.getLlmResponse(summaryPrompt);
            const summary = llmResponse.text.trim();

            // Calculate compression metrics
            const originalLength = conversationText.length;
            const summaryLength = summary.length;
            const compressionRatio = originalLength > 0 ? summaryLength / originalLength : 1;

            const result: SummarizationResult = {
                summary,
                messageCount: messagesToSummarize.length,
                compressionRatio,
                timestamp: Date.now()
            };

            const duration = Date.now() - startTime;
            this.logger.info(
                `Summarization complete: ${messagesToSummarize.length} messages → ` +
                `${summary.length} chars (${(compressionRatio * 100).toFixed(1)}% of original) ` +
                `in ${duration}ms`
            );

            return result;

        } catch (error: any) {
            this.logger.error(`Summarization failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Format messages for summarization
     */
    private formatMessagesForSummarization(messages: ConversationMessage[]): string {
        return messages.map((msg, index) => {
            const role = msg.role === 'user' ? 'User' : 'Assistant';
            return `[${index + 1}] ${role}: ${msg.content}`;
        }).join('\n\n');
    }

    /**
     * Build summarization prompt
     */
    private buildSummarizationPrompt(conversationText: string): any {
        return {
            system_message: `You are a conversation summarization expert. Your task is to create concise, accurate summaries of conversations.

SUMMARIZATION GUIDELINES
========================
1. Capture key topics and themes discussed
2. Preserve important facts, decisions, and conclusions
3. Maintain chronological flow of conversation
4. Include user's questions and assistant's main points
5. Omit redundant information and small talk
6. Use clear, concise language
7. Organize by topics if multiple subjects were discussed

OUTPUT FORMAT
=============
Create a structured summary with:
- Main topics discussed
- Key information exchanged
- Important decisions or conclusions
- Any action items or follow-ups mentioned

Keep the summary focused and informative, typically 200-400 words depending on conversation length.`,
            current_user_query: `Please summarize the following conversation:\n\n${conversationText}`,
            conversation_history: [],
            session_id: 'summarization',
            user_id: 'system'
        };
    }

    /**
     * Create a summary message that can be inserted into conversation history
     */
    createSummaryMessage(summary: string, messageCount: number): ConversationMessage {
        return {
            role: 'assistant',
            content: `[CONVERSATION SUMMARY - ${messageCount} previous messages]\n\n${summary}`,
            timestamp: Date.now()
        };
    }

    /**
     * Apply summarization to conversation history
     * Returns: [summaryMessage, ...recentMessages]
     */
    async applySummarization(
        messages: ConversationMessage[],
        userId: string,
        sessionId: string
    ): Promise<ConversationMessage[]> {
        if (!this.needsSummarization(messages.length)) {
            return messages;
        }

        try {
            const result = await this.summarizeConversation(messages, userId, sessionId);
            const summaryMessage = this.createSummaryMessage(result.summary, result.messageCount);
            const recentMessages = messages.slice(-this.config.keepRecentCount);

            this.logger.info(
                `Applied summarization: ${messages.length} messages → ` +
                `1 summary + ${recentMessages.length} recent messages`
            );

            return [summaryMessage, ...recentMessages];

        } catch (error: any) {
            this.logger.error(`Failed to apply summarization: ${error.message}`);
            // Return original messages if summarization fails
            return messages;
        }
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<SummarizationConfig>): void {
        this.config = { ...this.config, ...config };
        this.logger.info('Summarization config updated', this.config);
    }

    /**
     * Get current configuration
     */
    getConfig(): SummarizationConfig {
        return { ...this.config };
    }

    /**
     * Get summarization statistics
     */
    getStats(): any {
        return {
            config: this.config,
            description: 'Automatic conversation summarization service',
            features: [
                'Automatic triggering based on message count',
                'Preserves recent messages',
                'LLM-powered intelligent summarization',
                'Compression ratio tracking',
                'Graceful fallback on errors'
            ]
        };
    }
}

export default new SummarizationService();
