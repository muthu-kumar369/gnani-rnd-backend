// src/services/contextEngine.js
const logger = require('../utils/logger');
const contextBuilder = require('./contextBuilder'); // Import ContextBuilder

class ContextEngine {
    constructor() {
        logger.info('ContextEngine initialized.');
    }

    /**
     * Builds a comprehensive prompt for the LLM based on session, user, and query context.
     * This method now delegates context gathering to ContextBuilder.
     * @param {string} sessionId - The ID of the current session.
     * @param {string} userId - The ID of the user.
     * @param {Object} processedQuery - The output from QueryProcessor (cleanedText, intent).
     * @returns {Promise<Object>} A structured prompt object for the LLM.
     */
    async buildLLMPrompt(sessionId, userId, processedQuery) {
        logger.debug(`Building LLM prompt for session ${sessionId}, user ${userId}. Intent: ${processedQuery.intent}`);

        // Get consolidated context from ContextBuilder
        const context = await contextBuilder.buildContext(
            userId,
            sessionId,
            processedQuery.cleanedText,
            3 // topKEmbeddings - configurable
        );

        // 4. Construct the final LLM prompt using the gathered context
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
            conversation_history: context.shortTermMemory, // Array of { query, response }
            current_user_query: context.currentQuery,
            classified_intent: processedQuery.intent, // Intent comes directly from processedQuery
            long_term_context: context.longTermContext.join('\n'), // Join relevant document strings
            // Placeholder for action directives
            action_directives_guide: `If the intent is 'system_command', 'utility_request', or 'multi_step_instruction', consider suggesting a system action in JSON format, e.g., { "action": "OPEN_APP", "app_name": "Calculator" }. Ensure actions are authorized by user_roles/permissions.`,
        };

        logger.debug(`LLM Prompt for session ${sessionId}: ${JSON.stringify(llmPrompt)}`);
        return llmPrompt;
    }
    // The getLongTermContext method is no longer needed here as its functionality is moved to vectorManager and used by contextBuilder.
}

module.exports = new ContextEngine();
