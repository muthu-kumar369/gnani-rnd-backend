import { Logger } from 'winston';
import { ContextManager } from '../context-manager.service.js';

export class PromptHelper {
    constructor(private logger: Logger) { }

    formatPrompt(structuredPrompt: any, contextManager: ContextManager): string {
        // STAGE 1: Build messages array for context manager
        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

        // Add conversation history
        if (structuredPrompt.conversation_history && structuredPrompt.conversation_history.length > 0) {
            structuredPrompt.conversation_history.forEach((interaction: any) => {
                if (interaction.query) {
                    messages.push({ role: 'user', content: interaction.query });
                }
                if (interaction.response) {
                    messages.push({ role: 'assistant', content: interaction.response });
                }
            });
        }

        // Add current query
        messages.push({ role: 'user', content: structuredPrompt.current_user_query });

        // STAGE 1: Truncate context if needed
        const { messages: truncatedMessages, truncated } = contextManager.truncateContext(
            messages,
            structuredPrompt.system_message
        );

        if (truncated) {
            this.logger.warn('Context window truncated for LLM', {
                originalMessages: messages.length,
                truncatedMessages: truncatedMessages.length - 1 // -1 for system message
            });
        }

        // Format truncated messages for LLM
        let promptParts: string[] = [];

        for (const msg of truncatedMessages) {
            if (msg.role === 'system') {
                promptParts.push(`System: ${msg.content}`);
            } else if (msg.role === 'user') {
                promptParts.push(`User: ${msg.content}`);
            } else if (msg.role === 'assistant') {
                promptParts.push(`Assistant: ${msg.content}`);
            }
        }

        promptParts.push(`\n=== CURRENT INTERACTION ===`);
        promptParts.push(`Assistant:`);

        return promptParts.join('\n');
    }
}
