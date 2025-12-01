// src/services/contextBuilder.ts
import logger from '../../core/logger/logger.js';
import settingsManager from '../user/settings.manager.js';
import memoryManager from '../memory/memory.manager.js';

class ContextBuilder {
    constructor() {
        logger.info('ContextBuilder initialized.');
    }

    async buildContext(userId: string, sessionId: string, currentQuery: string, tokenBudget = 4000, complexityScore?: number): Promise<any> {
        logger.debug(`Building context for session ${sessionId}, user ${userId}. Query: "${currentQuery}"`);

        const userSettings = await settingsManager.getUserSettings(userId);

        // Use unified memory manager to get all context
        const memoryContext = await memoryManager.getContextForPrompt(
            userId,
            sessionId,
            currentQuery,
            tokenBudget,
            complexityScore
        );

        return {
            userId,
            sessionId,
            currentQuery,
            userProfile: userSettings.profile,
            userSettings: userSettings.settings,
            userPreferences: userSettings.preferences,
            userRoles: userSettings.roles,
            userPermissions: userSettings.permissions,
            shortTermMemory: memoryContext.shortTermMessages,
            longTermContext: memoryContext.longTermMemories,
            sessionState: memoryContext.sessionState,
            memoryMetadata: memoryContext.metadata,
            timestamp: new Date().toISOString(),
        };
    }
}

export default new ContextBuilder();
