// src/services/actionDispatcher.ts
import { createContextualLogger } from '../../core/logger/logger.js';
import metrics from '../../core/monitoring/metrics.js';
import auditService from '../../core/logger/audit.service.js';
import permissionsChecker from '../../core/security/permissions.checker.js';
import User from '../../modules/user/user.entity.js';
import systemExecutor from '../system/system.executor.js';
import electronComm from '../electron/electron.service.js';
import { Logger } from 'winston';

interface ActionObject {
    action: string;
    [key: string]: any;
}

class ActionDispatcher {
    private logger: Logger;
    private actionHandlers: { [key: string]: (userId: string, actionObject: ActionObject, sessionId?: string | null) => Promise<any> };

    constructor() {
        this.logger = createContextualLogger({ module: 'ActionDispatcher' });
        this.logger.info('ActionDispatcher initialized.');
        this.actionHandlers = {
            OPEN_APP: this._dispatchToElectron,
            SEARCH_WEB: this._dispatchToElectron,
            SET_TIMER: this._dispatchToElectron,
            CONTROL_VOLUME: this._dispatchToElectron,
        };
    }

    async dispatch(userId: string, actionObject: ActionObject, sessionId: string | null = null): Promise<{ success: boolean, message: string }> {
        if (!actionObject || !actionObject.action) {
            this.logger.warn(`Attempted to dispatch an invalid action for user ${userId}: ${JSON.stringify(actionObject)}`);
            auditService.logActionDispatch(userId, sessionId, actionObject, 'failure', 'Invalid action object');
            return { success: false, message: 'Invalid action object provided.' };
        }

        const { action } = actionObject;

        const user = await User.findOne({ userId }).select('roles permissions');
        if (!user) {
            this.logger.error(`User ${userId} not found for action dispatch.`);
            auditService.logActionDispatch(userId, sessionId, actionObject, 'failure', 'User not found for permission check');
            return { success: false, message: 'User not found for permission check.' };
        }
        const userRoles = user.roles || [];
        const userPermissions = user.permissions || [];

        const requiredPermission = this._getRequiredPermissionForAction(action);
        if (requiredPermission && !permissionsChecker.checkPermission(userRoles, userPermissions, requiredPermission)) {
            const message = `Permission denied for action: ${action}`;
            this.logger.warn(message);
            auditService.logActionDispatch(userId, sessionId, actionObject, 'denied', message);
            return { success: false, message: message };
        }

        const handler = this.actionHandlers[action];
        if (handler) {
            this.logger.info(`Dispatching action '${action}' for user ${userId} with payload: ${JSON.stringify(actionObject)}`);
            try {
                const result = await handler.call(this, userId, actionObject, sessionId);
                if (sessionId) {
                    metrics.incActionDispatch(sessionId, action, result.success ? 'success' : 'failure');
                }
                auditService.logActionDispatch(userId, sessionId, actionObject, result.success ? 'success' : 'failure', result);
                return result;
            } catch (error: any) {
                this.logger.error(`Error executing action '${action}' for user ${userId}: ${error.message}`);
                if (sessionId) {
                    metrics.incActionDispatch(sessionId, action, 'error');
                }
                auditService.logActionDispatch(userId, sessionId, actionObject, 'error', error.message);
                return { success: false, message: `Error executing action: ${error.message}` };
            }
        } else {
            const message = `No handler found for action: ${action}`;
            this.logger.warn(message);
            if (sessionId) {
                metrics.incActionDispatch(sessionId, action, 'failure');
            }
            auditService.logActionDispatch(userId, sessionId, actionObject, 'failure', message);
            return { success: false, message: message };
        }
    }

    private _getRequiredPermissionForAction(action: string): string | null {
        switch (action) {
            case 'OPEN_APP': return 'system:control';
            case 'SEARCH_WEB': return 'system:read';
            case 'SET_TIMER': return 'utility:timer';
            case 'CONTROL_VOLUME': return 'system:control';
            default: return null;
        }
    }

    private async _dispatchToElectron(userId: string, actionObject: ActionObject, sessionId: string | null = null): Promise<{ success: boolean, message: string }> {
        this.logger.debug(`[ActionDispatcher] Sending action to Electron for user ${userId}, session ${sessionId}: ${JSON.stringify(actionObject)}`);
        electronComm.sendActionInstructions(sessionId, actionObject);
        return { success: true, message: `Action '${actionObject.action}' dispatched to Electron.` };
    }
}

export default new ActionDispatcher();
