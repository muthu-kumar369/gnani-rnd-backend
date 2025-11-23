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
            3 // topKEmbeddings - configurable
        );

        const llmPrompt = {
            system_message: `You are GNANI, an advanced AI assistant designed to help users with a wide range of tasks. You can have natural conversations, execute system commands, and access user-specific information.
            Current Time: ${context.timestamp}
            User Profile: ${JSON.stringify(context.userProfile)}`,
            user_settings: JSON.stringify(context.userSettings),
            user_preferences: JSON.stringify(context.userPreferences),
            user_roles: context.userRoles,
            user_permissions: context.userPermissions,
            session_id: context.sessionId,
            user_id: context.userId,
            conversation_history: context.shortTermMemory,
            current_user_query: context.currentQuery,
            classified_intent: processedQuery.intent,
            long_term_context: context.longTermContext.join('\n'),
            action_directives_guide: `If the intent is 'system_command', 'utility_request', or 'multi_step_instruction', consider suggesting a system action in JSON format, e.g., { "action": "OPEN_APP", "app_name": "Calculator" }. Ensure actions are authorized by user_roles/permissions.`,
        };

        logger.debug(`LLM Prompt for session ${sessionId}: ${JSON.stringify(llmPrompt)}`);
        return llmPrompt;
    }
}

export default new ContextEngine();
