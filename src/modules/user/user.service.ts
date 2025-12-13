// src/services/userService.ts
import User, { IUser, IDevice } from './user.entity.js';
import { createContextualLogger } from '../../core/logger/logger.js';
import auditService from '../../core/logger/audit.service.js';
import cacheService from '../../core/cache/cache.service.js';
import { Logger } from 'winston';
import { redisClient } from '../../config/redis.config.js'; // STAGE 13

export class UserService {
    private logger: Logger;

    constructor() {
        this.logger = createContextualLogger({ module: 'UserService' });
    }

    async getUserById(userId: string): Promise<IUser> {
        const user = await User.findOne({ userId }).select('-passwordHash');
        if (!user) {
            this.logger.warn(`User ${userId} not found when retrieving user by ID.`);
            auditService.logEvent('USER_BY_ID_RETRIEVAL_SERVICE', userId, null, { action: 'getUserById', reason: 'User not found' }, 'failure');
            throw new Error('User not found');
        }
        this.logger.info(`User retrieved by ID for user: ${userId}`);
        auditService.logEvent('USER_BY_ID_RETRIEVAL_SERVICE', userId, null, { action: 'getUserById' }, 'success');
        return user;
    }

    async getUserProfile(userId: string): Promise<IUser> {
        const user = await User.findOne({ userId }).select('-passwordHash -security -history -devices -notes -metadata');
        if (!user) {
            this.logger.warn(`User ${userId} not found when retrieving profile.`);
            auditService.logEvent('USER_PROFILE_RETRIEVAL_SERVICE', userId, null, { action: 'getUserProfile', reason: 'User not found' }, 'failure');
            throw new Error('User not found');
        }
        this.logger.info(`User profile retrieved for user: ${userId}`);
        auditService.logEvent('USER_PROFILE_RETRIEVAL_SERVICE', userId, null, { action: 'getUserProfile' }, 'success');
        return user;
    }

    async updateUserProfile(userId: string, profileData: any): Promise<IUser> {
        const user = await User.findOne({ userId });
        if (!user) {
            this.logger.warn(`User ${userId} not found when updating profile.`);
            auditService.logEvent('USER_PROFILE_UPDATE_SERVICE', userId, null, { action: 'updateUserProfile', reason: 'User not found' }, 'failure');
            throw new Error('User not found');
        }

        if (profileData.firstName) user.profile.firstName = profileData.firstName;
        if (profileData.lastName) user.profile.lastName = profileData.lastName;
        if (profileData.dob) user.profile.dob = profileData.dob;
        if (profileData.locale) user.profile.locale = profileData.locale;
        if (profileData.language) user.profile.language = profileData.language;
        if (profileData.profilePhoto) user.profile.profilePhoto = profileData.profilePhoto;

        await user.save();

        // Invalidate related caches
        await cacheService.del([
            `api:${userId}::user:me`,
            `api:${userId}::user:profile`
        ]);

        this.logger.info(`User profile updated for user: ${userId}`);
        auditService.logEvent('USER_PROFILE_UPDATE_SERVICE', userId, null, { action: 'updateUserProfile', updatedFields: Object.keys(profileData) }, 'success');
        return user;
    }

    async getUserSettings(userId: string): Promise<any> {
        const user = await User.findOne({ userId }).select('settings preferences');
        if (!user) {
            this.logger.warn(`User ${userId} not found when retrieving settings.`);
            auditService.logEvent('USER_SETTINGS_RETRIEVAL_SERVICE', userId, null, { action: 'getUserSettings', reason: 'User not found' }, 'failure');
            throw new Error('User not found');
        }
        this.logger.info(`User settings retrieved for user: ${userId}`);
        auditService.logEvent('USER_SETTINGS_RETRIEVAL_SERVICE', userId, null, { action: 'getUserSettings' }, 'success');

        const defaultSettings = {
            wakeWord: 'Hey Gnani',
            preferredVoice: 'default',
            volume: 75,
            theme: 'dark',
            avatarEnabled: true,
            avatarGender: 'female'
        };

        const mergedSettings = { ...defaultSettings, ...(user.settings ? JSON.parse(JSON.stringify(user.settings)) : {}) };

        return { settings: mergedSettings, preferences: user.preferences };
    }

    async updateUserSettings(userId: string, settingsData: any): Promise<any> {
        const user = await User.findOne({ userId });
        if (!user) {
            this.logger.warn(`User ${userId} not found when updating settings.`);
            auditService.logEvent('USER_SETTINGS_UPDATE_SERVICE', userId, null, { action: 'updateUserSettings', reason: 'User not found' }, 'failure');
            throw new Error('User not found');
        }

        // Safely merge settings
        if (settingsData.settings) {
            // Use Mongoose's set() or direct assignment with Object.assign to ensure subdocument is updated correctly
            // We convert existing settings to object to avoid Mongoose internal properties issues during merge
            const currentSettings = user.settings ? JSON.parse(JSON.stringify(user.settings)) : {};
            user.settings = { ...currentSettings, ...settingsData.settings };
            user.markModified('settings');
        }

        if (settingsData.preferences) {
            user.preferences = { ...user.preferences, ...settingsData.preferences };
            user.markModified('preferences');
        }

        await user.save();

        // Invalidate related caches
        // Note: Middleware generates keys as api:{userId}:{routerPath} (e.g., api:123:profile)
        // We include both legacy/potential formats and the calculated middleware format to be safe.
        const cacheKeys = [
            `api:${userId}::user:me`,
            `api:${userId}::user:settings`,
            `api:${userId}::user:profile`,
            `api:${userId}:me`,
            `api:${userId}:settings`,
            `api:${userId}:profile`
        ];

        if (settingsData.preferences) {
            cacheKeys.push(`api:${userId}::user:preferences`);
            cacheKeys.push(`api:${userId}:preferences`);

            // Explicitly clear the dedicated preferences cache used by getUserPreferences
            try {
                await redisClient.del(`user:${userId}:preferences`);
                this.logger.debug('Invalidated user preferences cache from settings update', { userId });
            } catch (error) {
                this.logger.warn('Failed to invalidate preferences cache', { error });
            }
        }

        await cacheService.del(cacheKeys);

        this.logger.info(`User settings updated for user: ${userId}`);
        auditService.logEvent('USER_SETTINGS_UPDATE_SERVICE', userId, null, { action: 'updateUserSettings', updatedFields: Object.keys(settingsData) }, 'success');
        return user.settings;
    }

    async getUserPreferences(userId: string): Promise<any> {
        // STAGE 13 Step 2: Check Redis cache first
        const cacheKey = `user:${userId}:preferences`;
        try {
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                this.logger.debug('Cache HIT for user preferences', { userId });
                return JSON.parse(cached);
            }
            this.logger.debug('Cache MISS for user preferences', { userId });
        } catch (error) {
            this.logger.warn('Redis cache read failed for preferences', { error });
        }

        const user = await User.findOne({ userId }).select('preferences');
        if (!user) {
            this.logger.warn(`User ${userId} not found when retrieving preferences.`);
            auditService.logEvent('USER_PREFERENCES_RETRIEVAL_SERVICE', userId, null, { action: 'getUserPreferences', reason: 'User not found' }, 'failure');
            throw new Error('User not found');
        }
        this.logger.info(`User preferences retrieved for user: ${userId}`);
        auditService.logEvent('USER_PREFERENCES_RETRIEVAL_SERVICE', userId, null, { action: 'getUserPreferences' }, 'success');

        const preferences = user.preferences || {};

        // STAGE 13: Cache the result (1 hour TTL)
        try {
            await redisClient.setex(cacheKey, 3600, JSON.stringify(preferences));
            this.logger.debug('Cached user preferences', { userId, ttl: 3600 });
        } catch (error) {
            this.logger.warn('Failed to cache user preferences', { error });
        }

        return preferences;
    }

    async updateUserPreferences(userId: string, preferencesData: any): Promise<any> {
        const user = await User.findOne({ userId });
        if (!user) {
            this.logger.warn(`User ${userId} not found when updating preferences.`);
            auditService.logEvent('USER_PREFERENCES_UPDATE_SERVICE', userId, null, { action: 'updateUserPreferences', reason: 'User not found' }, 'failure');
            throw new Error('User not found');
        }

        // Merge preferences (PATCH semantics - partial update)
        user.preferences = { ...user.preferences, ...preferencesData };
        user.markModified('preferences');

        await user.save();

        // STAGE 13: Invalidate Redis cache
        try {
            await redisClient.del(`user:${userId}:preferences`);
            this.logger.debug('Invalidated user preferences cache', { userId });
        } catch (error) {
            this.logger.warn('Failed to invalidate preferences cache', { error });
        }

        // Invalidate related caches
        await cacheService.del([
            `api:${userId}::user:me`,
            `api:${userId}::user:settings`,
            `api:${userId}::user:preferences`
        ]);

        this.logger.info(`User preferences updated for user: ${userId}`);
        auditService.logEvent('USER_PREFERENCES_UPDATE_SERVICE', userId, null, { action: 'updateUserPreferences', updatedFields: Object.keys(preferencesData) }, 'success');
        return user.preferences;
    }

    async getUserDevices(userId: string): Promise<IDevice[]> {
        const user = await User.findOne({ userId });
        if (!user) {
            this.logger.warn(`User ${userId} not found when retrieving devices.`);
            auditService.logEvent('USER_DEVICES_RETRIEVAL_SERVICE', userId, null, { action: 'getUserDevices', reason: 'User not found' }, 'failure');
            throw new Error('User not found');
        }
        this.logger.info(`User devices retrieved for user: ${userId}`);
        auditService.logEvent('USER_DEVICES_RETRIEVAL_SERVICE', userId, null, { action: 'getUserDevices' }, 'success');
        return user.devices;
    }

    async addDevice(userId: string, deviceData: IDevice): Promise<IDevice[]> {
        const user = await User.findOne({ userId });
        if (!user) {
            this.logger.warn(`User ${userId} not found when adding device.`);
            auditService.logEvent('USER_DEVICE_ADD_SERVICE', userId, null, { action: 'addDevice', reason: 'User not found' }, 'failure');
            throw new Error('User not found');
        }
        user.devices.push(deviceData);
        await user.save();

        // Invalidate devices cache
        await cacheService.del(`api:${userId}::user:devices`);

        this.logger.info(`Device added for user: ${userId}`);
        auditService.logEvent('USER_DEVICE_ADD_SERVICE', userId, null, { action: 'addDevice', deviceName: deviceData.deviceName }, 'success');
        return user.devices;
    }

    async updateDevice(userId: string, deviceId: string, updateData: Partial<IDevice>): Promise<IDevice[]> {
        const user = await User.findOne({ userId });
        if (!user) {
            this.logger.warn(`User ${userId} not found when updating device.`);
            auditService.logEvent('USER_DEVICE_UPDATE_SERVICE', userId, null, { action: 'updateDevice', deviceId, reason: 'User not found' }, 'failure');
            throw new Error('User not found');
        }

        const deviceIndex = user.devices.findIndex((d: IDevice) => d.deviceId === deviceId);
        if (deviceIndex === -1) {
            this.logger.warn(`Device ${deviceId} not found for user ${userId} during update.`);
            auditService.logEvent('USER_DEVICE_UPDATE_SERVICE', userId, null, { action: 'updateDevice', deviceId, reason: 'Device not found' }, 'failure');
            throw new Error('User not found');
        }

        user.devices[deviceIndex] = { ...(user.devices[deviceIndex].toObject()), ...updateData };
        await user.save();

        // Invalidate devices cache
        await cacheService.del(`api:${userId}::user:devices`);

        this.logger.info(`Device ${deviceId} updated for user: ${userId}`);
        auditService.logEvent('USER_DEVICE_UPDATE_SERVICE', userId, null, { action: 'updateDevice', deviceId, updatedFields: Object.keys(updateData) }, 'success');
        return user.devices;
    }

    async removeDevice(userId: string, deviceId: string): Promise<IDevice[]> {
        const user = await User.findOne({ userId });
        if (!user) {
            this.logger.warn(`User ${userId} not found when removing device.`);
            auditService.logEvent('USER_DEVICE_REMOVE_SERVICE', userId, null, { action: 'removeDevice', deviceId, reason: 'User not found' }, 'failure');
            throw new Error('User not found');
        }

        user.devices = user.devices.filter((d: IDevice) => d.deviceId !== deviceId);
        await user.save();

        // Invalidate devices cache
        await cacheService.del(`api:${userId}::user:devices`);

        this.logger.info(`Device ${deviceId} removed for user: ${userId}`);
        auditService.logEvent('USER_DEVICE_REMOVE_SERVICE', userId, null, { action: 'removeDevice', deviceId }, 'success');
        return user.devices;
    }

    async getUserSecurity(userId: string): Promise<any> {
        const user = await User.findOne({ userId }).select('security');
        if (!user) {
            this.logger.warn(`User ${userId} not found when retrieving security info.`);
            auditService.logEvent('USER_SECURITY_RETRIEVAL_SERVICE', userId, null, { action: 'getUserSecurity', reason: 'User not found' }, 'failure');
            throw new Error('User not found');
        }
        this.logger.info(`User security info retrieved for user: ${userId}`);
        auditService.logEvent('USER_SECURITY_RETRIEVAL_SERVICE', userId, null, { action: 'getUserSecurity' }, 'success');
        return user.security;
    }

    async updateUserSecurity(userId: string, securityData: any): Promise<any> {
        const user = await User.findOne({ userId });
        if (!user) {
            this.logger.warn(`User ${userId} not found when updating security info.`);
            auditService.logEvent('USER_SECURITY_UPDATE_SERVICE', userId, null, { action: 'updateUserSecurity', reason: 'User not found' }, 'failure');
            throw new Error('User not found');
        }

        if (securityData.mfaEnabled !== undefined) user.security.mfaEnabled = securityData.mfaEnabled;
        if (securityData.recoveryEmail) user.security.recoveryEmail = securityData.recoveryEmail;

        await user.save();

        // Invalidate security cache
        await cacheService.del(`api:${userId}::user:security`);

        this.logger.info(`User security info updated for user: ${userId}`);
        auditService.logEvent('USER_SECURITY_UPDATE_SERVICE', userId, null, { action: 'updateUserSecurity', updatedFields: Object.keys(securityData) }, 'success');
        return user.security;
    }

    async getUserOAuthProviders(userId: string): Promise<any[]> {
        const user = await User.findOne({ userId }).select('oauthProviders');
        if (!user) {
            this.logger.warn(`User ${userId} not found when retrieving OAuth providers.`);
            auditService.logEvent('USER_OAUTH_RETRIEVAL_SERVICE', userId, null, { action: 'getUserOAuthProviders', reason: 'User not found' }, 'failure');
            throw new Error('User not found');
        }
        this.logger.info(`User OAuth providers retrieved for user: ${userId}`);
        auditService.logEvent('USER_OAUTH_RETRIEVAL_SERVICE', userId, null, { action: 'getUserOAuthProviders' }, 'success');
        return user.oauthProviders;
    }

    async unlinkOAuthProvider(userId: string, provider: string): Promise<any[]> {
        const user = await User.findOne({ userId });
        if (!user) {
            this.logger.warn(`User ${userId} not found when unlinking OAuth provider.`);
            auditService.logEvent('USER_OAUTH_UNLINK_SERVICE', userId, null, { action: 'unlinkOAuthProvider', provider, reason: 'User not found' }, 'failure');
            throw new Error('User not found');
        }

        user.oauthProviders = user.oauthProviders.filter(p => p.provider !== provider);
        await user.save();

        // Invalidate OAuth cache
        await cacheService.del(`api:${userId}::user:oauth`);

        this.logger.info(`OAuth provider ${provider} unlinked for user: ${userId}`);
        auditService.logEvent('USER_OAUTH_UNLINK_SERVICE', userId, null, { action: 'unlinkOAuthProvider', provider }, 'success');
        return user.oauthProviders;
    }

    async getUserHistory(userId: string): Promise<any[]> {
        const user = await User.findOne({ userId }).select('history');
        if (!user) {
            this.logger.warn(`User ${userId} not found when retrieving history.`);
            auditService.logEvent('USER_HISTORY_RETRIEVAL_SERVICE', userId, null, { action: 'getUserHistory', reason: 'User not found' }, 'failure');
            throw new Error('User not found');
        }
        this.logger.info(`User history retrieved for user: ${userId}`);
        auditService.logEvent('USER_HISTORY_RETRIEVAL_SERVICE', userId, null, { action: 'getUserHistory' }, 'success');
        return user.history;
    }

    async deleteUserHistoryItem(userId: string, historyId: string): Promise<any[]> {
        const user = await User.findOne({ userId });
        if (!user) {
            this.logger.warn(`User ${userId} not found when deleting history item.`);
            auditService.logEvent('USER_HISTORY_DELETE_ITEM_SERVICE', userId, null, { action: 'deleteUserHistoryItem', historyId, reason: 'User not found' }, 'failure');
            throw new Error('User not found');
        }

        user.history = user.history.filter((h: any) => h._id.toString() !== historyId);
        await user.save();

        // Invalidate history cache
        await cacheService.del(`api:${userId}::user:history`);

        this.logger.info(`History item ${historyId} deleted for user: ${userId}`);
        auditService.logEvent('USER_HISTORY_DELETE_ITEM_SERVICE', userId, null, { action: 'deleteUserHistoryItem', historyId }, 'success');
        return user.history;
    }

    async clearUserHistory(userId: string): Promise<void> {
        const user = await User.findOne({ userId });
        if (!user) {
            this.logger.warn(`User ${userId} not found when clearing history.`);
            auditService.logEvent('USER_HISTORY_CLEAR_SERVICE', userId, null, { action: 'clearUserHistory', reason: 'User not found' }, 'failure');
            throw new Error('User not found');
        }

        user.history = [];
        await user.save();

        // Invalidate history cache
        await cacheService.del(`api:${userId}::user:history`);

        this.logger.info(`History cleared for user: ${userId}`);
        auditService.logEvent('USER_HISTORY_CLEAR_SERVICE', userId, null, { action: 'clearUserHistory' }, 'success');
    }

    async getUserNotes(userId: string): Promise<string[]> {
        const user = await User.findOne({ userId }).select('notes');
        if (!user) {
            this.logger.warn(`User ${userId} not found when retrieving notes.`);
            auditService.logEvent('USER_NOTES_RETRIEVAL_SERVICE', userId, null, { action: 'getUserNotes', reason: 'User not found' }, 'failure');
            throw new Error('User not found');
        }
        this.logger.info(`User notes retrieved for user: ${userId}`);
        auditService.logEvent('USER_NOTES_RETRIEVAL_SERVICE', userId, null, { action: 'getUserNotes' }, 'success');
        return user.notes;
    }

    async addUserNote(userId: string, note: string): Promise<string[]> {
        const user = await User.findOne({ userId });
        if (!user) {
            this.logger.warn(`User ${userId} not found when adding note.`);
            auditService.logEvent('USER_NOTE_ADD_SERVICE', userId, null, { action: 'addUserNote', reason: 'User not found' }, 'failure');
            throw new Error('User not found');
        }

        user.notes.push(note);
        await user.save();

        // Invalidate notes cache
        await cacheService.del(`api:${userId}::user:notes`);

        this.logger.info(`Note added for user: ${userId}`);
        auditService.logEvent('USER_NOTE_ADD_SERVICE', userId, null, { action: 'addUserNote' }, 'success');
        return user.notes;
    }

    async deleteUserNote(userId: string, index: number): Promise<string[]> {
        const user = await User.findOne({ userId });
        if (!user) {
            this.logger.warn(`User ${userId} not found when deleting note.`);
            auditService.logEvent('USER_NOTE_DELETE_SERVICE', userId, null, { action: 'deleteUserNote', index, reason: 'User not found' }, 'failure');
            throw new Error('User not found');
        }

        if (index >= 0 && index < user.notes.length) {
            user.notes.splice(index, 1);
            await user.save();

            // Invalidate notes cache
            await cacheService.del(`api:${userId}::user:notes`);

            this.logger.info(`Note at index ${index} deleted for user: ${userId}`);
            auditService.logEvent('USER_NOTE_DELETE_SERVICE', userId, null, { action: 'deleteUserNote', index }, 'success');
        } else {
            this.logger.warn(`Invalid note index ${index} for user ${userId}.`);
            throw new Error('Invalid note index');
        }
        return user.notes;
    }
}
