// src/services/settingsManager.js
const NodeCache = require('node-cache');
const logger = require('../utils/logger');
const User = require('../models/User'); // Import the User model

class SettingsManager {
    constructor(ttlSeconds = 300) { // Default TTL: 5 minutes
        this.cache = new NodeCache({ stdTTL: ttlSeconds, checkperiod: ttlSeconds * 0.2, useClones: false });
        logger.info('SettingsManager initialized with caching.');
    }

    /**
     * Retrieves user-specific settings and profile data from MongoDB, with caching.
     * @param {string} userId - The ID of the user.
     * @returns {Promise<Object>} Object containing user settings, profile, preferences, roles, and permissions.
     */
    async getUserSettings(userId) {
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
                // Return default settings if user not found
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
        } catch (error) {
            logger.error(`Error fetching user settings for ${userId}: ${error.message}`);
            // Fallback to default settings on error
            return this._getDefaultUserSettings();
        }
    }

    /**
     * Provides default settings for a user.
     * @returns {Object} Default user settings.
     */
    _getDefaultUserSettings() {
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

    /**
     * Clears user settings from cache (e.g., after an update).
     * @param {string} userId - The ID of the user.
     */
    clearUserCache(userId) {
        const cacheKey = `user_settings_${userId}`;
        this.cache.del(cacheKey);
        logger.debug(`User settings cache cleared for ${userId}`);
    }
}

module.exports = new SettingsManager();
