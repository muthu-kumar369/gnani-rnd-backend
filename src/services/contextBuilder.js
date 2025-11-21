// src/services/contextBuilder.js
const logger = require('../utils/logger');
const settingsManager = require('./settingsManager');
const vectorManager = require('./vectorManager');
const queryProcessor = require('./queryProcessor'); // For short-term memory

class ContextBuilder {
    constructor() {
        logger.info('ContextBuilder initialized.');
    }

    /**
     * Merges user settings, short-term session memory, and long-term vector embeddings
     * into a comprehensive context object for LLM prompt construction.
     * @param {string} userId - The ID of the user.
     * @param {string} sessionId - The ID of the current session.
     * @param {string} currentQuery - The user's current cleaned query.
     * @param {number} topKEmbeddings - Number of top relevant embeddings to retrieve.
     * @returns {Promise<Object>} A structured context object.
     */
    async buildContext(userId, sessionId, currentQuery, topKEmbeddings = 3) {
        logger.debug(`Building context for session ${sessionId}, user ${userId}. Query: "${currentQuery}"`);

        // 1. Get user settings, profile, roles, permissions
        const userSettings = await settingsManager.getUserSettings(userId);

        // 2. Get short-term session memory
        const sessionMemory = queryProcessor.getSessionMemory(sessionId);

        // 3. Get long-term memory (relevant embeddings)
        const longTermContext = await vectorManager.getRelevantEmbeddings(userId, currentQuery, topKEmbeddings);

        return {
            userId,
            sessionId,
            currentQuery,
            userProfile: userSettings.profile,
            userSettings: userSettings.settings,
            userPreferences: userSettings.preferences,
            userRoles: userSettings.roles,
            userPermissions: userSettings.permissions,
            shortTermMemory: sessionMemory,
            longTermContext: longTermContext,
            timestamp: new Date().toISOString(),
        };
    }
}

module.exports = new ContextBuilder();
