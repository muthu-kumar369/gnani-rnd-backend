// src/services/userService.js
const User = require('../models/User');
const { createContextualLogger } = require('../utils/logger'); // Import logger factory
const auditService = require('../services/auditService'); // Import audit service

class UserService {
    constructor() {
        this.logger = createContextualLogger({ module: 'UserService' }); // Create a logger instance
    }

    /**
     * Retrieves non-sensitive user profile data.
     * @param {string} userId - The ID of the user.
     * @returns {Object} - User profile data.
     */
    async getUserProfile(userId) {
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

    /**
     * Updates user settings.
     * @param {string} userId - The ID of the user.
     * @param {Object} settingsData - Data to update settings.
     * @returns {Object} - Updated user settings.
     */
    async updateUserSettings(userId, settingsData) {
        const user = await User.findOne({ userId });
        if (!user) {
            this.logger.warn(`User ${userId} not found when updating settings.`);
            auditService.logEvent('USER_SETTINGS_UPDATE_SERVICE', userId, null, { action: 'updateUserSettings', reason: 'User not found' }, 'failure');
            throw new Error('User not found');
        }

        // Deep merge for settings and preferences
        user.settings = { ...user.settings, ...settingsData.settings };
        user.preferences = { ...user.preferences, ...settingsData.preferences };

        await user.save();
        this.logger.info(`User settings updated for user: ${userId}`);
        auditService.logEvent('USER_SETTINGS_UPDATE_SERVICE', userId, null, { action: 'updateUserSettings', updatedFields: Object.keys(settingsData) }, 'success');
        return user.settings;
    }

    /**
     * Retrieves registered devices for a user.
     * @param {string} userId - The ID of the user.
     * @returns {Array} - Array of device objects.
     */
    async getUserDevices(userId) {
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

    /**
     * Adds a new device for a user.
     * @param {string} userId - The ID of the user.
     * @param {Object} deviceData - Data for the new device.
     * @returns {Array} - Updated array of device objects.
     */
    async addDevice(userId, deviceData) {
        const user = await User.findOne({ userId });
        if (!user) {
            this.logger.warn(`User ${userId} not found when adding device.`);
            auditService.logEvent('USER_DEVICE_ADD_SERVICE', userId, null, { action: 'addDevice', reason: 'User not found' }, 'failure');
            throw new Error('User not found');
        }
        user.devices.push(deviceData);
        await user.save();
        this.logger.info(`Device added for user: ${userId}`);
        auditService.logEvent('USER_DEVICE_ADD_SERVICE', userId, null, { action: 'addDevice', deviceName: deviceData.deviceName }, 'success');
        return user.devices;
    }

    /**
     * Updates an existing device for a user.
     * @param {string} userId - The ID of the user.
     * @param {string} deviceId - The ID of the device to update.
     * @param {Object} updateData - Data to update the device.
     * @returns {Array} - Updated array of device objects.
     */
    async updateDevice(userId, deviceId, updateData) {
        const user = await User.findOne({ userId });
        if (!user) {
            this.logger.warn(`User ${userId} not found when updating device.`);
            auditService.logEvent('USER_DEVICE_UPDATE_SERVICE', userId, null, { action: 'updateDevice', deviceId, reason: 'User not found' }, 'failure');
            throw new Error('User not found');
        }

        const deviceIndex = user.devices.findIndex(d => d.deviceId === deviceId);
        if (deviceIndex === -1) {
            this.logger.warn(`Device ${deviceId} not found for user ${userId} during update.`);
            auditService.logEvent('USER_DEVICE_UPDATE_SERVICE', userId, null, { action: 'updateDevice', deviceId, reason: 'Device not found' }, 'failure');
            throw new Error('Device not found');
        }

        user.devices[deviceIndex] = { ...user.devices[deviceIndex], ...updateData };
        await user.save();
        this.logger.info(`Device ${deviceId} updated for user: ${userId}`);
        auditService.logEvent('USER_DEVICE_UPDATE_SERVICE', userId, null, { action: 'updateDevice', deviceId, updatedFields: Object.keys(updateData) }, 'success');
        return user.devices;
    }
}

module.exports = new UserService();
