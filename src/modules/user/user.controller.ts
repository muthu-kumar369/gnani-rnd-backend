// src/controllers/userController.ts
import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service.js';
import { createContextualLogger } from '../../core/logger/logger.js'; // Import logger factory
import auditService from '../../core/logger/audit.service.js'; // Import audit service
import errorHandler from '../../core/http/error.middleware.js';
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

    async getMe(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
        const userId = req.fullUser?.userId || (req as any).userId;
        try {
            if (!userId) {
                throw new Error('User ID not found in request');
            }
            const user = await this.userServiceInstance.getUserById(userId);
            auditService.logEvent('USER_ME_RETRIEVAL', userId, null, { action: 'getMe' }, 'success');
            res.status(200).json(user);
        } catch (error: any) {
            this.logger.error(`Get me error for user ${userId}: ${error.message}`);
            auditService.logEvent('USER_ME_RETRIEVAL', userId || null, null, { action: 'getMe', error: error.message }, 'failure');
            next(error);
        }
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

    async updateProfile(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
        const userId = req.fullUser?.userId;
        const profileData = req.body;
        try {
            if (!userId) {
                throw new Error('User ID not found in request');
            }
            const updatedUser = await this.userServiceInstance.updateUserProfile(userId, profileData);
            auditService.logEvent('USER_PROFILE_UPDATE', userId, null, { action: 'updateProfile', updatedFields: Object.keys(profileData) }, 'success');
            res.status(200).json({ message: 'Profile updated successfully', profile: updatedUser.profile });
        } catch (error: any) {
            this.logger.error(`Update profile error for user ${userId}: ${error.message}`);
            auditService.logEvent('USER_PROFILE_UPDATE', userId || null, null, { action: 'updateProfile', error: error.message }, 'failure');
            next(error);
        }
    }

    async getSettings(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
        const userId = req.fullUser?.userId;
        try {
            if (!userId) {
                throw new Error('User ID not found in request');
            }
            const settings = await this.userServiceInstance.getUserSettings(userId);
            auditService.logEvent('USER_SETTINGS_RETRIEVAL', userId, null, { action: 'getSettings' }, 'success');
            res.status(200).json(settings);
        } catch (error: any) {
            this.logger.error(`Get settings error for user ${userId}: ${error.message}`);
            auditService.logEvent('USER_SETTINGS_RETRIEVAL', userId || null, null, { action: 'getSettings', error: error.message }, 'failure');
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

    async getPreferences(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
        const userId = req.fullUser?.userId;
        try {
            if (!userId) {
                throw new Error('User ID not found in request');
            }
            const preferences = await this.userServiceInstance.getUserPreferences(userId);
            auditService.logEvent('USER_PREFERENCES_RETRIEVAL', userId, null, { action: 'getPreferences' }, 'success');
            res.status(200).json(preferences);
        } catch (error: any) {
            this.logger.error(`Get preferences error for user ${userId}: ${error.message}`);
            auditService.logEvent('USER_PREFERENCES_RETRIEVAL', userId || null, null, { action: 'getPreferences', error: error.message }, 'failure');
            next(error);
        }
    }

    async updatePreferences(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
        const userId = req.fullUser?.userId;
        const preferencesData = req.body;
        try {
            if (!userId) {
                throw new Error('User ID not found in request');
            }
            const updatedPreferences = await this.userServiceInstance.updateUserPreferences(userId, preferencesData);
            auditService.logEvent('USER_PREFERENCES_UPDATE', userId, null, { action: 'updatePreferences', updatedFields: Object.keys(preferencesData) }, 'success');
            res.status(200).json(updatedPreferences);
        } catch (error: any) {
            this.logger.error(`Update preferences error for user ${userId}: ${error.message}`);
            auditService.logEvent('USER_PREFERENCES_UPDATE', userId || null, null, { action: 'updatePreferences', error: error.message }, 'failure');
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

    async removeDevice(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
        const userId = req.fullUser?.userId;
        const { deviceId } = req.params;
        try {
            if (!userId) {
                throw new Error('User ID not found in request');
            }
            const devices = await this.userServiceInstance.removeDevice(userId, deviceId);
            auditService.logEvent('USER_DEVICE_REMOVE', userId, null, { action: 'removeDevice', deviceId }, 'success');
            res.status(200).json({ message: 'Device removed successfully', devices });
        } catch (error: any) {
            this.logger.error(`Remove device error for user ${userId}, device ${deviceId}: ${error.message}`);
            auditService.logEvent('USER_DEVICE_REMOVE', userId || null, null, { action: 'removeDevice', deviceId, error: error.message }, 'failure');
            next(error);
        }
    }

    async getSecurity(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
        const userId = req.fullUser?.userId;
        try {
            if (!userId) {
                throw new Error('User ID not found in request');
            }
            const security = await this.userServiceInstance.getUserSecurity(userId);
            auditService.logEvent('USER_SECURITY_RETRIEVAL', userId, null, { action: 'getSecurity' }, 'success');
            res.status(200).json(security);
        } catch (error: any) {
            this.logger.error(`Get security error for user ${userId}: ${error.message}`);
            auditService.logEvent('USER_SECURITY_RETRIEVAL', userId || null, null, { action: 'getSecurity', error: error.message }, 'failure');
            next(error);
        }
    }

    async updateSecurity(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
        const userId = req.fullUser?.userId;
        const securityData = req.body;
        try {
            if (!userId) {
                throw new Error('User ID not found in request');
            }
            const security = await this.userServiceInstance.updateUserSecurity(userId, securityData);
            auditService.logEvent('USER_SECURITY_UPDATE', userId, null, { action: 'updateSecurity', updatedFields: Object.keys(securityData) }, 'success');
            res.status(200).json({ message: 'Security info updated successfully', security });
        } catch (error: any) {
            this.logger.error(`Update security error for user ${userId}: ${error.message}`);
            auditService.logEvent('USER_SECURITY_UPDATE', userId || null, null, { action: 'updateSecurity', error: error.message }, 'failure');
            next(error);
        }
    }

    async getOAuthProviders(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
        const userId = req.fullUser?.userId;
        try {
            if (!userId) {
                throw new Error('User ID not found in request');
            }
            const providers = await this.userServiceInstance.getUserOAuthProviders(userId);
            auditService.logEvent('USER_OAUTH_RETRIEVAL', userId, null, { action: 'getOAuthProviders' }, 'success');
            res.status(200).json(providers);
        } catch (error: any) {
            this.logger.error(`Get OAuth providers error for user ${userId}: ${error.message}`);
            auditService.logEvent('USER_OAUTH_RETRIEVAL', userId || null, null, { action: 'getOAuthProviders', error: error.message }, 'failure');
            next(error);
        }
    }

    async unlinkOAuthProvider(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
        const userId = req.fullUser?.userId;
        const { provider } = req.params;
        try {
            if (!userId) {
                throw new Error('User ID not found in request');
            }
            const providers = await this.userServiceInstance.unlinkOAuthProvider(userId, provider);
            auditService.logEvent('USER_OAUTH_UNLINK', userId, null, { action: 'unlinkOAuthProvider', provider }, 'success');
            res.status(200).json({ message: 'OAuth provider unlinked successfully', providers });
        } catch (error: any) {
            this.logger.error(`Unlink OAuth provider error for user ${userId}, provider ${provider}: ${error.message}`);
            auditService.logEvent('USER_OAUTH_UNLINK', userId || null, null, { action: 'unlinkOAuthProvider', provider, error: error.message }, 'failure');
            next(error);
        }
    }

    async getHistory(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
        const userId = req.fullUser?.userId;
        try {
            if (!userId) {
                throw new Error('User ID not found in request');
            }
            const history = await this.userServiceInstance.getUserHistory(userId);
            auditService.logEvent('USER_HISTORY_RETRIEVAL', userId, null, { action: 'getHistory' }, 'success');
            res.status(200).json(history);
        } catch (error: any) {
            this.logger.error(`Get history error for user ${userId}: ${error.message}`);
            auditService.logEvent('USER_HISTORY_RETRIEVAL', userId || null, null, { action: 'getHistory', error: error.message }, 'failure');
            next(error);
        }
    }

    async deleteHistoryItem(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
        const userId = req.fullUser?.userId;
        const { id } = req.params;
        try {
            if (!userId) {
                throw new Error('User ID not found in request');
            }
            const history = await this.userServiceInstance.deleteUserHistoryItem(userId, id);
            auditService.logEvent('USER_HISTORY_DELETE_ITEM', userId, null, { action: 'deleteHistoryItem', historyId: id }, 'success');
            res.status(200).json({ message: 'History item deleted successfully', history });
        } catch (error: any) {
            this.logger.error(`Delete history item error for user ${userId}, item ${id}: ${error.message}`);
            auditService.logEvent('USER_HISTORY_DELETE_ITEM', userId || null, null, { action: 'deleteHistoryItem', historyId: id, error: error.message }, 'failure');
            next(error);
        }
    }

    async clearHistory(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
        const userId = req.fullUser?.userId;
        try {
            if (!userId) {
                throw new Error('User ID not found in request');
            }
            await this.userServiceInstance.clearUserHistory(userId);
            auditService.logEvent('USER_HISTORY_CLEAR', userId, null, { action: 'clearHistory' }, 'success');
            res.status(200).json({ message: 'History cleared successfully' });
        } catch (error: any) {
            this.logger.error(`Clear history error for user ${userId}: ${error.message}`);
            auditService.logEvent('USER_HISTORY_CLEAR', userId || null, null, { action: 'clearHistory', error: error.message }, 'failure');
            next(error);
        }
    }

    async getNotes(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
        const userId = req.fullUser?.userId;
        try {
            if (!userId) {
                throw new Error('User ID not found in request');
            }
            const notes = await this.userServiceInstance.getUserNotes(userId);
            auditService.logEvent('USER_NOTES_RETRIEVAL', userId, null, { action: 'getNotes' }, 'success');
            res.status(200).json(notes);
        } catch (error: any) {
            this.logger.error(`Get notes error for user ${userId}: ${error.message}`);
            auditService.logEvent('USER_NOTES_RETRIEVAL', userId || null, null, { action: 'getNotes', error: error.message }, 'failure');
            next(error);
        }
    }

    async addNote(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
        const userId = req.fullUser?.userId;
        const { note } = req.body;
        try {
            if (!userId) {
                throw new Error('User ID not found in request');
            }
            const notes = await this.userServiceInstance.addUserNote(userId, note);
            auditService.logEvent('USER_NOTE_ADD', userId, null, { action: 'addNote' }, 'success');
            res.status(201).json({ message: 'Note added successfully', notes });
        } catch (error: any) {
            this.logger.error(`Add note error for user ${userId}: ${error.message}`);
            auditService.logEvent('USER_NOTE_ADD', userId || null, null, { action: 'addNote', error: error.message }, 'failure');
            next(error);
        }
    }

    async deleteNote(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
        const userId = req.fullUser?.userId;
        const { index } = req.params;
        try {
            if (!userId) {
                throw new Error('User ID not found in request');
            }
            const notes = await this.userServiceInstance.deleteUserNote(userId, parseInt(index));
            auditService.logEvent('USER_NOTE_DELETE', userId, null, { action: 'deleteNote', index }, 'success');
            res.status(200).json({ message: 'Note deleted successfully', notes });
        } catch (error: any) {
            this.logger.error(`Delete note error for user ${userId}, index ${index}: ${error.message}`);
            auditService.logEvent('USER_NOTE_DELETE', userId || null, null, { action: 'deleteNote', index, error: error.message }, 'failure');
            next(error);
        }
    }
}

export default new UserController();
