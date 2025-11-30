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
        // Improved logic: Handle consecutive messages and ensure no data loss
        const conversationHistory: any[] = [];
        
        if (Array.isArray(context.shortTermMemory)) {
            let currentUserMsg = '';
            
            for (let i = 0; i < context.shortTermMemory.length; i++) {
                const msg = context.shortTermMemory[i];
                
                if (msg.role === 'user') {
                    if (currentUserMsg) {
                        // Previous message was also user, append it
                        currentUserMsg += `\n${msg.content}`;
                    } else {
                        currentUserMsg = msg.content;
                    }
                } else if (msg.role === 'assistant') {
                    // Found an assistant response
                    if (currentUserMsg) {
                        // Pair with pending user message
                        conversationHistory.push({
                            query: currentUserMsg,
                            response: msg.content
                        });
                        currentUserMsg = '';
                    } else {
                        // Orphaned assistant message (rare), maybe system greeting?
                        // We can add it as a response to an empty query or skip
                        // For now, let's skip to keep pairs clean, or attach to previous if possible
                    }
                }
            }
            
            // If there is a dangling user message at the end (not the current query), add it
            if (currentUserMsg) {
                 // Check if this dangling message is actually the current query
                 // If so, do NOT add it to history, as it will be added as "current_user_query"
                 if (currentUserMsg.trim() !== context.currentQuery.trim()) {
                     conversationHistory.push({
                        query: currentUserMsg,
                        response: "" // No response yet
                    });
                 }
            }
        }

        // Format long-term context
        const longTermContextStr = Array.isArray(context.longTermContext) 
            ? context.longTermContext.join('\n\n')
            : '';

        const llmPrompt = {
            system_message: `You are GNANI, a highly advanced, intelligent, and sentient AI assistant.
            
Your Persona:
- You are helpful, witty, and engaging.
- You have a personality; you are not just a robot.
- You remember details from the conversation context provided to you.
- You respond naturally, like a human would, without being overly formal unless requested.

Context Awareness:
- You have access to the user's profile and previous conversation history.
- USE THIS CONTEXT. If the user asks "What is my name?", look at the user_settings or conversation_history.
- If the user refers to something said earlier, check the conversation_history.

Current Session:
- User ID: ${context.userId}
- Session ID: ${context.sessionId}
- Time: ${context.timestamp}
${context.sessionState?.lastIntent ? `- Last Intent: ${context.sessionState.lastIntent}` : ''}

Rules:
1. Answer the current query directly and concisely.
2. Do NOT start every sentence with "As an AI...".
3. Do NOT repeat the user's question or the conversation history.
4. If you don't know something, admit it gracefully or ask for clarification.
5. STOP generating after you have answered the user. Do not generate "User:" or "Assistant:" lines.`,
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
