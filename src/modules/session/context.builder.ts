// src/modules/session/context.builder.ts
import { createContextualLogger } from '../../core/logger/logger.js';
import sessionMemory from '../memory/services/session-memory.service.js';
import vectorManager from '../vector/vector.manager.js';
import intentClassifier, { IntentClassification } from '../../core/nlp/intent-classifier.js';
import promptSelector from '../../core/prompts/prompt-selector.js';
import toolRegistry from '../../core/tools/tool-registry.js';
import { Logger } from 'winston';

interface Context {
    transcript: string;
    recentMessages: any[];
    relevantMemories: string[];
    systemPrompt: string;
    attachments?: any[];
    intent?: IntentClassification;
    tools?: object[];
}

export class ContextBuilder {
    private logger: Logger;
    private MAX_CONTEXT_MESSAGES = 10;

    constructor() {
        this.logger = createContextualLogger({ module: 'ContextBuilder' });
    }

    async build(sessionId: string, userId: string, transcript: string, attachments?: any[], systemPromptOverride?: string, templateInstructions?: string): Promise<Context> {
        try {
            // ... (previous steps 1-4) ...

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

            // 4. Classify intent
            this.logger.info(`Classifying intent for transcript...`);
            const intent = await intentClassifier.classify(transcript, {
                sessionId,
                userId,
                recentMessages: cachedMessages
            });
            this.logger.info(`Intent classified`, {
                intent: intent.intent,
                confidence: intent.confidence,
                subIntent: intent.subIntent
            });

            // 5. Build system prompt with intent-specific guidance
            const systemPrompt = this.buildSystemPrompt(relevantMemories, intent, systemPromptOverride, templateInstructions);

            // ... (rest of the method) ...

            // 6. Get cross-conversation context (NEW)
            let crossConversationContext = '';
            try {
                this.logger.info(`Getting cross-conversation context...`);
                const memoryLinking = await import('../memory/cross-conversation-memory.service.js');

                // Get enriched context from related conversations
                crossConversationContext = await memoryLinking.default.getEnrichedContext(
                    sessionId,
                    userId,
                    transcript
                );

                if (crossConversationContext) {
                    this.logger.info(`Added cross-conversation context from related conversations`);
                }
            } catch (error: any) {
                this.logger.warn('Failed to get cross-conversation context', {
                    error: error.message
                });
                // Continue without cross-conversation context
            }

            // 7. Get tool schemas for LLM function calling
            const tools = toolRegistry.getToolSchemas();

            const context: Context = {
                transcript: enhancedTranscript,
                recentMessages: cachedMessages.slice(-this.MAX_CONTEXT_MESSAGES),
                relevantMemories,
                systemPrompt: crossConversationContext
                    ? systemPrompt + '\n\n' + crossConversationContext
                    : systemPrompt,
                attachments,
                intent,
                tools
            };

            this.logger.debug('Context built', {
                sessionId,
                messagesCount: context.recentMessages.length,
                memoriesCount: relevantMemories.length,
                attachmentsCount: attachments?.length || 0,
                intent: intent.intent,
                intentConfidence: intent.confidence,
                toolsCount: tools.length,
                hasCrossConversationContext: !!crossConversationContext
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

    private buildSystemPrompt(memories: string[], intent: IntentClassification, customPrompt?: string, templateInstructions?: string): string {
        // Base prompt (Identity)
        // If customPrompt is strictly provided, it overrides the default identity.
        // But Template Instructions are ADDITIVE.
        const basePrompt = customPrompt || 'You are Gnani, a helpful AI assistant.';

        // Get intent-specific prompt which typically wraps the base prompt
        let prompt = promptSelector.getSystemPrompt(intent.intent, basePrompt);

        // ADDITIVE TEMPLATE
        if (templateInstructions) {
            prompt += '\n\n--- TEMPLATE INSTRUCTIONS ---\n' + templateInstructions + '\n-----------------------------\n';
        }

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
