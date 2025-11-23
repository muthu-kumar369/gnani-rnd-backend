// src/services/settingsManager.ts
import NodeCache from 'node-cache';
import logger from '../../core/logger/logger.js';
import User, { IUser } from './user.entity.js';

class SettingsManager {
    private cache: NodeCache;

    constructor(ttlSeconds = 300) {
        this.cache = new NodeCache({ stdTTL: ttlSeconds, checkperiod: ttlSeconds * 0.2, useClones: false });
        logger.info('SettingsManager initialized with caching.');
    }

    async getUserSettings(userId: string): Promise<any> {
        const cacheKey = `user_settings_${userId}`;
        let settings = this.cache.get(cacheKey);

        if (settings) {
            logger.debug(`Cache HIT for user settings: ${userId}`);
            return settings;
        }

        logger.debug(`Cache MISS for user settings: ${userId}. Fetching from DB.`);
        try {
            const user = await User.findOne({ userId }).select('profile settings preferences roles permissions');
            if (!user) {
                logger.warn(`User ${userId} not found when fetching settings.`);
                settings = this._getDefaultUserSettings();
            } else {
                settings = {
                    profile: user.profile || {},
                    settings: user.settings || {},
                    preferences: user.preferences || {},
                    roles: user.roles || ['user'],
                    permissions: user.permissions || [],
                };
            }
            this.cache.set(cacheKey, settings);
            return settings;
        } catch (error: any) {
            logger.error(`Error fetching user settings for ${userId}: ${error.message}`);
            return this._getDefaultUserSettings();
        }
    }

    private _getDefaultUserSettings(): any {
        return {
            profile: {},
            settings: {
                wakeWord: 'Hey Gnani',
                preferredVoice: 'default',
                volume: 75,
                theme: 'dark'
            },
            preferences: {},
            roles: ['user'],
            permissions: [],
        };
    }

    clearUserCache(userId: string): void {
        const cacheKey = `user_settings_${userId}`;
        this.cache.del(cacheKey);
        logger.debug(`User settings cache cleared for ${userId}`);
    }
}

export default new SettingsManager();
