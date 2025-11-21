// src/controllers/userController.js
const userService = require('../services/userService');
const { createContextualLogger } = require('../utils/logger'); // Import logger factory
const auditService = require('../services/auditService'); // Import audit service
const errorHandler = require('../utils/error_handler');

class UserController {
    constructor() {
        this.logger = createContextualLogger({ module: 'UserController' }); // Create a logger instance
    }

    async getProfile(req, res, next) {
        const userId = req.fullUser.userId;
        try {
            const profile = await userService.getUserProfile(userId);
            auditService.logEvent('USER_PROFILE_RETRIEVAL', userId, null, { action: 'getProfile' }, 'success');
            res.status(200).json(profile);
        } catch (error) {
            this.logger.error(`Get profile error for user ${userId}: ${error.message}`);
            auditService.logEvent('USER_PROFILE_RETRIEVAL', userId, null, { action: 'getProfile', error: error.message }, 'failure');
            next(error);
        }
    }

    async updateSettings(req, res, next) {
        const userId = req.fullUser.userId;
        const { settings, preferences } = req.body;
        try {
            const updatedSettings = await userService.updateUserSettings(userId, { settings, preferences });
            auditService.logEvent('USER_SETTINGS_UPDATE', userId, null, { action: 'updateSettings', settings: settings, preferences: preferences }, 'success');
            res.status(200).json({ message: 'Settings updated successfully', settings: updatedSettings });
        } catch (error) {
            this.logger.error(`Update settings error for user ${userId}: ${error.message}`);
            auditService.logEvent('USER_SETTINGS_UPDATE', userId, null, { action: 'updateSettings', error: error.message }, 'failure');
            next(error);
        }
    }

    async getDevices(req, res, next) {
        const userId = req.fullUser.userId;
        try {
            const devices = await userService.getUserDevices(userId);
            auditService.logEvent('USER_DEVICES_RETRIEVAL', userId, null, { action: 'getDevices' }, 'success');
            res.status(200).json(devices);
        } catch (error) {
            this.logger.error(`Get devices error for user ${userId}: ${error.message}`);
            auditService.logEvent('USER_DEVICES_RETRIEVAL', userId, null, { action: 'getDevices', error: error.message }, 'failure');
            next(error);
        }
    }

    async addDevice(req, res, next) {
        const userId = req.fullUser.userId;
        const newDevice = req.body;
        try {
            const devices = await userService.addDevice(userId, newDevice);
            auditService.logEvent('USER_DEVICE_ADD', userId, null, { action: 'addDevice', device: newDevice }, 'success');
            res.status(201).json({ message: 'Device added successfully', devices });
        } catch (error) {
            this.logger.error(`Add device error for user ${userId}: ${error.message}`);
            auditService.logEvent('USER_DEVICE_ADD', userId, null, { action: 'addDevice', device: newDevice, error: error.message }, 'failure');
            next(error);
        }
    }

    async updateDevice(req, res, next) {
        const userId = req.fullUser.userId;
        const { deviceId } = req.params;
        const updateData = req.body;
        try {
            const devices = await userService.updateDevice(userId, deviceId, updateData);
            auditService.logEvent('USER_DEVICE_UPDATE', userId, null, { action: 'updateDevice', deviceId, updateData }, 'success');
            res.status(200).json({ message: 'Device updated successfully', devices });
        } catch (error) {
            this.logger.error(`Update device error for user ${userId}, device ${deviceId}: ${error.message}`);
            auditService.logEvent('USER_DEVICE_UPDATE', userId, null, { action: 'updateDevice', deviceId, updateData, error: error.message }, 'failure');
            next(error);
        }
    }
}

module.exports = new UserController();
