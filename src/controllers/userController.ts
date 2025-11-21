// src/controllers/userController.ts
import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/userService.js';
import { createContextualLogger } from '../utils/logger.js'; // Import logger factory
import auditService from '../services/auditService.js'; // Import audit service
import errorHandler from '../utils/error_handler.js';
import { Logger } from 'winston';

// Add a custom property to the Request object
interface CustomRequest extends Request {
    fullUser?: {
        userId: string;
    };
}

class UserController {
    private logger: Logger;
    private userServiceInstance: UserService;

    constructor() {
        this.logger = createContextualLogger({ module: 'UserController' }); // Create a logger instance
        this.userServiceInstance = new UserService();
    }

    async getProfile(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
        const userId = req.fullUser?.userId;
        try {
            if (!userId) {
                throw new Error('User ID not found in request');
            }
            const profile = await this.userServiceInstance.getUserProfile(userId);
            auditService.logEvent('USER_PROFILE_RETRIEVAL', userId, null, { action: 'getProfile' }, 'success');
            res.status(200).json(profile);
        } catch (error: any) {
            this.logger.error(`Get profile error for user ${userId}: ${error.message}`);
            auditService.logEvent('USER_PROFILE_RETRIEVAL', userId || null, null, { action: 'getProfile', error: error.message }, 'failure');
            next(error);
        }
    }

    async updateSettings(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
        const userId = req.fullUser?.userId;
        const { settings, preferences } = req.body;
        try {
            if (!userId) {
                throw new Error('User ID not found in request');
            }
            const updatedSettings = await this.userServiceInstance.updateUserSettings(userId, { settings, preferences });
            auditService.logEvent('USER_SETTINGS_UPDATE', userId, null, { action: 'updateSettings', settings: settings, preferences: preferences }, 'success');
            res.status(200).json({ message: 'Settings updated successfully', settings: updatedSettings });
        } catch (error: any) {
            this.logger.error(`Update settings error for user ${userId}: ${error.message}`);
            auditService.logEvent('USER_SETTINGS_UPDATE', userId || null, null, { action: 'updateSettings', error: error.message }, 'failure');
            next(error);
        }
    }

    async getDevices(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
        const userId = req.fullUser?.userId;
        try {
            if (!userId) {
                throw new Error('User ID not found in request');
            }
            const devices = await this.userServiceInstance.getUserDevices(userId);
            auditService.logEvent('USER_DEVICES_RETRIEVAL', userId, null, { action: 'getDevices' }, 'success');
            res.status(200).json(devices);
        } catch (error: any) {
            this.logger.error(`Get devices error for user ${userId}: ${error.message}`);
            auditService.logEvent('USER_DEVICES_RETRIEVAL', userId || null, null, { action: 'getDevices', error: error.message }, 'failure');
            next(error);
        }
    }

    async addDevice(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
        const userId = req.fullUser?.userId;
        const newDevice = req.body;
        try {
            if (!userId) {
                throw new Error('User ID not found in request');
            }
            const devices = await this.userServiceInstance.addDevice(userId, newDevice);
            auditService.logEvent('USER_DEVICE_ADD', userId, null, { action: 'addDevice', device: newDevice }, 'success');
            res.status(201).json({ message: 'Device added successfully', devices });
        } catch (error: any) {
            this.logger.error(`Add device error for user ${userId}: ${error.message}`);
            auditService.logEvent('USER_DEVICE_ADD', userId || null, null, { action: 'addDevice', device: newDevice, error: error.message }, 'failure');
            next(error);
        }
    }

    async updateDevice(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
        const userId = req.fullUser?.userId;
        const { deviceId } = req.params;
        const updateData = req.body;
        try {
            if (!userId) {
                throw new Error('User ID not found in request');
            }
            const devices = await this.userServiceInstance.updateDevice(userId, deviceId, updateData);
            auditService.logEvent('USER_DEVICE_UPDATE', userId, null, { action: 'updateDevice', deviceId, updateData }, 'success');
            res.status(200).json({ message: 'Device updated successfully', devices });
        } catch (error: any) {
            this.logger.error(`Update device error for user ${userId}, device ${deviceId}: ${error.message}`);
            auditService.logEvent('USER_DEVICE_UPDATE', userId || null, null, { action: 'updateDevice', deviceId, updateData, error: error.message }, 'failure');
            next(error);
        }
    }
}

export default new UserController();
