// src/services/contextBuilder.ts
import logger from '../../core/logger/logger.js';
import settingsManager from '../user/settings.manager.js';
import vectorManager from '../vector/vector.manager.js';
import queryProcessor from '../query/query.processor.js';

class ContextBuilder {
    constructor() {
        logger.info('ContextBuilder initialized.');
    }

    async buildContext(userId: string, sessionId: string, currentQuery: string, topKEmbeddings = 3): Promise<any> {
        logger.debug(`Building context for session ${sessionId}, user ${userId}. Query: "${currentQuery}"`);

        const userSettings = await settingsManager.getUserSettings(userId);
        const sessionMemory = queryProcessor.getSessionMemory(sessionId);
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

export default new ContextBuilder();
