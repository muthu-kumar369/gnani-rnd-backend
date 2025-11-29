// src/services/contextEngine.ts
import logger from '../../core/logger/logger.js';
import contextBuilder from './context.builder.js';

class ContextEngine {
    constructor() {
        logger.info('ContextEngine initialized.');
    }

    async buildLLMPrompt(sessionId: string, userId: string, processedQuery: { cleanedText: string; intent: string; }): Promise<any> {
        logger.debug(`Building LLM prompt for session ${sessionId}, user ${userId}. Intent: ${processedQuery.intent}`);

        const context = await contextBuilder.buildContext(
            userId,
            sessionId,
            processedQuery.cleanedText,
            4000 // Token budget for context
        );

        // Format short-term memory as conversation history
        // Need to pair user messages with assistant responses
        const conversationHistory: any[] = [];
        
        if (Array.isArray(context.shortTermMemory)) {
            for (let i = 0; i < context.shortTermMemory.length; i++) {
                const msg = context.shortTermMemory[i];
                
                if (msg.role === 'user') {
                    // Look for the next assistant message
                    const nextMsg = context.shortTermMemory[i + 1];
                    conversationHistory.push({
                        query: msg.content,
                        response: (nextMsg && nextMsg.role === 'assistant') ? nextMsg.content : ''
                    });
                    
                    // Skip the assistant message since we already processed it
                    if (nextMsg && nextMsg.role === 'assistant') {
                        i++;
                    }
                }
            }
        }

        // Format long-term context
        const longTermContextStr = Array.isArray(context.longTermContext) 
            ? context.longTermContext.join('\n\n')
            : '';

        const llmPrompt = {
            system_message: `You are GNANI, an intelligent AI assistant. Respond naturally and concisely to user queries.
            
Current Time: ${context.timestamp}
${context.sessionState?.lastIntent ? `Last Intent: ${context.sessionState.lastIntent}` : ''}

Rules:
- Answer the current query directly
- Be concise and natural
- Use conversation context when relevant
- Do NOT repeat the conversation history in your response`,
            user_settings: JSON.stringify(context.userSettings),
            user_preferences: JSON.stringify(context.userPreferences),
            user_roles: context.userRoles,
            user_permissions: context.userPermissions,
            session_id: context.sessionId,
            user_id: context.userId,
            conversation_history: conversationHistory,
            current_user_query: context.currentQuery,
            classified_intent: processedQuery.intent,
            long_term_context: longTermContextStr,
            action_directives_guide: `If the intent is 'system_command', 'utility_request', or 'multi_step_instruction', consider suggesting a system action in JSON format, e.g., { "action": "OPEN_APP", "app_name": "Calculator" }. Ensure actions are authorized by user_roles/permissions.`,
        };

        logger.debug(`LLM Prompt for session ${sessionId}: ${JSON.stringify(llmPrompt)}`);
        return llmPrompt;
    }
}

export default new ContextEngine();
