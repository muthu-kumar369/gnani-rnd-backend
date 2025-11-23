// src/services/userService.ts
import User, { IUser, IDevice } from './user.entity.js';
import { createContextualLogger } from '../../core/logger/logger.js';
import auditService from '../../core/logger/audit.service.js';
import { Logger } from 'winston';

export class UserService {
    private logger: Logger;

    constructor() {
        this.logger = createContextualLogger({ module: 'UserService' });
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

    async updateUserSettings(userId: string, settingsData: any): Promise<any> {
        const user = await User.findOne({ userId });
        if (!user) {
            this.logger.warn(`User ${userId} not found when updating settings.`);
            auditService.logEvent('USER_SETTINGS_UPDATE_SERVICE', userId, null, { action: 'updateUserSettings', reason: 'User not found' }, 'failure');
            throw new Error('User not found');
        }

        user.settings = { ...user.settings, ...settingsData.settings };
        user.preferences = { ...user.preferences, ...settingsData.preferences };

        await user.save();
        this.logger.info(`User settings updated for user: ${userId}`);
        auditService.logEvent('USER_SETTINGS_UPDATE_SERVICE', userId, null, { action: 'updateUserSettings', updatedFields: Object.keys(settingsData) }, 'success');
        return user.settings;
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
        this.logger.info(`Device ${deviceId} updated for user: ${userId}`);
        auditService.logEvent('USER_DEVICE_UPDATE_SERVICE', userId, null, { action: 'updateDevice', deviceId, updatedFields: Object.keys(updateData) }, 'success');
        return user.devices;
    }
}