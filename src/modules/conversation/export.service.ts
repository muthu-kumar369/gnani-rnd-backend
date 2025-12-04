import Conversation from './conversation.model.js';
import ConversationMessage from '../memory/entities/conversation.entity.js';
import { createContextualLogger } from '../../core/logger/logger.js';

class ExportService {
    private logger = createContextualLogger({ module: 'ExportService' });

    /**
     * Export conversation to Markdown format
     */
    async exportToMarkdown(sessionId: string, userId: string): Promise<string> {
        const conversation = await Conversation.findOne({ sessionId, userId, isDeleted: false });

        if (!conversation) {
            throw new Error('Conversation not found');
        }

        // Fetch all messages for this conversation
        const messages = await ConversationMessage.find({ sessionId })
            .sort({ timestamp: 1 })
            .lean();

        const title = conversation.title || 'Untitled Conversation';
        const createdAt = new Date(conversation.createdAt).toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        let markdown = `# ${title}\n\n`;
        markdown += `**Created**: ${createdAt}\n`;
        markdown += `**Session ID**: ${sessionId}\n`;
        markdown += `**Messages**: ${messages.length}\n\n`;
        markdown += `---\n\n`;

        // Export messages
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            const timestamp = new Date(msg.timestamp).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });

            markdown += `## Message ${i + 1}\n\n`;
            markdown += `**Type**: ${this.capitalizeFirst(msg.type)}\n`;
            markdown += `**Time**: ${timestamp}\n`;

            // Add token usage if available (for gnani messages)
            if (msg.tokenUsage) {
                markdown += `**Tokens**: Input: ${msg.tokenUsage.inputTokens}, Output: ${msg.tokenUsage.outputTokens}, Total: ${msg.tokenUsage.totalTokens}\n`;
                markdown += `**Cost**: $${msg.tokenUsage.estimatedCost.toFixed(6)}\n`;
                markdown += `**Model**: ${msg.tokenUsage.model}\n`;
            }

            // Add metadata if available
            if (msg.metadata) {
                if (msg.metadata.image) {
                    markdown += `**Image**: ${msg.metadata.image}\n`;
                }
                if (msg.metadata.state) {
                    markdown += `**State**: ${msg.metadata.state}\n`;
                }
            }

            markdown += `\n${msg.content}\n\n`;
            markdown += `---\n\n`;
        }

        // Add footer
        const exportedAt = new Date().toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        markdown += `\n*Exported from Gnani on ${exportedAt}*\n`;

        return markdown;
    }

    /**
     * Export conversation to JSON format
     */
    async exportToJson(sessionId: string, userId: string): Promise<Record<string, any>> {
        const conversation = await Conversation.findOne({ sessionId, userId, isDeleted: false });

        if (!conversation) {
            throw new Error('Conversation not found');
        }

        // Fetch all messages for this conversation
        const messages = await ConversationMessage.find({ sessionId })
            .sort({ timestamp: 1 })
            .lean();

        return {
            sessionId: conversation.sessionId,
            title: conversation.title || 'Untitled Conversation',
            userId: conversation.userId,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
            exportedAt: new Date().toISOString(),
            messageCount: messages.length,
            messages: messages.map((msg) => ({
                id: msg._id,
                type: msg.type,
                content: msg.content,
                timestamp: msg.timestamp,
                parentId: msg.parentId,
                children: msg.children,
                branchIndex: msg.branchIndex,
                metadata: msg.metadata,
                tokenUsage: msg.tokenUsage,
            })),
            metadata: {
                exportFormat: 'json',
                exportVersion: '1.0',
                application: 'Gnani',
            },
        };
    }

    /**
     * Helper to capitalize first letter
     */
    private capitalizeFirst(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

export default new ExportService();
