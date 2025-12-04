// src/modules/session/context.builder.ts
import { createContextualLogger } from '../../core/logger/logger.js';
import sessionMemory from '../memory/services/session-memory.service.js';
import vectorManager from '../vector/vector.manager.js';
import { Logger } from 'winston';

interface Context {
    transcript: string;
    recentMessages: any[];
    relevantMemories: string[];
    systemPrompt: string;
    attachments?: any[];
}

export class ContextBuilder {
    private logger: Logger;
    private MAX_CONTEXT_MESSAGES = 10;

    constructor() {
        this.logger = createContextualLogger({ module: 'ContextBuilder' });
    }

    async build(sessionId: string, userId: string, transcript: string, attachments?: any[], customSystemPrompt?: string): Promise<Context> {
        try {
            // 1. Get recent messages from cache
            this.logger.info(`Getting cached messages for session ${sessionId}...`);
            const cachedMessages = await sessionMemory.getCachedMessages(sessionId) || [];
            this.logger.info(`Got ${cachedMessages.length} cached messages.`);

            // 2. Get relevant memories from vector search
            let relevantMemories: string[] = [];
            try {
                this.logger.info(`Getting relevant memories for user ${userId}...`);
                const memoryResults = await vectorManager.getRelevantEmbeddings(
                    userId,
                    transcript,
                    3 // top 3 results
                );
                this.logger.info(`Got ${memoryResults?.length || 0} relevant memories.`);
                relevantMemories = memoryResults || [];
            } catch (error: any) {
                this.logger.warn('Failed to retrieve relevant memories', {
                    sessionId,
                    error: error.message
                });
                // Continue without memories
            }

            // 3. Inject file content into transcript if attachments exist
            let enhancedTranscript = transcript;
            if (attachments && attachments.length > 0) {
                const fileContext = attachments.map(att =>
                    `[Attached File: ${att.fileName}]\n${att.parsedContent}\n`
                ).join('\n');
                enhancedTranscript = `${fileContext}\nUser's message: ${transcript}`;
                this.logger.info(`Injected ${attachments.length} file(s) into context`);
            }

            // 4. Build system prompt
            const systemPrompt = this.buildSystemPrompt(relevantMemories, customSystemPrompt);

            const context: Context = {
                transcript: enhancedTranscript,
                recentMessages: cachedMessages.slice(-this.MAX_CONTEXT_MESSAGES),
                relevantMemories,
                systemPrompt,
                attachments
            };

            this.logger.debug('Context built', {
                sessionId,
                messagesCount: context.recentMessages.length,
                memoriesCount: relevantMemories.length,
                attachmentsCount: attachments?.length || 0
            });

            return context;

        } catch (error: any) {
            this.logger.error('Error building context', { sessionId, error: error.message });

            // Return minimal context on error
            return {
                transcript,
                recentMessages: [],
                relevantMemories: [],
                systemPrompt: 'You are Gnani, a helpful AI assistant.'
            };
        }
    }

    private buildSystemPrompt(memories: string[], customPrompt?: string): string {
        let prompt = customPrompt || 'You are Gnani, a helpful AI assistant.';
        prompt += '\n\n';

        if (memories.length > 0) {
            prompt += 'Relevant context from previous conversations:\n';
            memories.forEach((memory, i) => {
                prompt += `${i + 1}. ${memory}\n`;
            });
            prompt += '\n';
        }

        return prompt;
    }
}
