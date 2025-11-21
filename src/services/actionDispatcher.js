// src/services/actionDispatcher.js
const { createContextualLogger } = require('../utils/logger'); // Import logger factory
const metrics = require('../utils/metrics'); // Import metrics
const auditService = require('../services/auditService'); // Import audit service
const permissionsChecker = require('../utils/permissionsChecker'); // To check user permissions
const User = require('../models/User'); // To fetch user roles and permissions
const systemExecutor = require('./systemExecutor'); // Import SystemExecutor
const electronComm = require('./electronComm'); // Import ElectronCommService

class ActionDispatcher {
    constructor() {
        this.logger = createContextualLogger({ module: 'ActionDispatcher' }); // Create a logger instance
        this.logger.info('ActionDispatcher initialized.');
        // Define a mapping of recognized action types to their handlers/expected parameters
        this.actionHandlers = {
            OPEN_APP: this._dispatchToElectron, // Actions that Electron should handle
            SEARCH_WEB: this._dispatchToElectron,
            SET_TIMER: this._dispatchToElectron,
            CONTROL_VOLUME: this._dispatchToElectron,
            // DIRECT_SYSTEM_COMMAND: this._handleDirectSystemCommand, // For actions executed directly by Node.js (less common/secure)
            // Add other system actions here
        };
    }

    /**
     * Dispatches an action based on the LLM's suggested action and user permissions.
     * @param {string} userId - The ID of the user requesting the action.
     * @param {Object} actionObject - The action suggested by the LLM, e.g., { action: "OPEN_APP", app_name: "Calculator" }.
     * @param {string} [sessionId] - The ID of the current session.
     * @returns {Promise<Object>} The result of the action or an error.
     */
    async dispatch(userId, actionObject, sessionId = null) {
        if (!actionObject || !actionObject.action) {
            this.logger.warn(`Attempted to dispatch an invalid action for user ${userId}: ${JSON.stringify(actionObject)}`);
            auditService.logActionDispatch(userId, sessionId, actionObject, 'failure', 'Invalid action object');
            return { success: false, message: 'Invalid action object provided.' };
        }

        const { action } = actionObject;

        // Fetch user roles and permissions for security check
        const user = await User.findOne({ userId }).select('roles permissions');
        if (!user) {
            this.logger.error(`User ${userId} not found for action dispatch.`);
            auditService.logActionDispatch(userId, sessionId, actionObject, 'failure', 'User not found for permission check');
            return { success: false, message: 'User not found for permission check.' };
        }
        const userRoles = user.roles || [];
        const userPermissions = user.permissions || [];

        // Check if the user has permission to execute this action
        const requiredPermission = this._getRequiredPermissionForAction(action);
        if (requiredPermission && !permissionsChecker.checkPermission(userRoles, userPermissions, requiredPermission)) {
            const message = `Permission denied for action: ${action}`;
            this.logger.warn(message);
            auditService.logActionDispatch(userId, sessionId, actionObject, 'denied', message);
            return { success: false, message: message };
        }

        // Execute the action if a handler exists
        const handler = this.actionHandlers[action];
        if (handler) {
            this.logger.info(`Dispatching action '${action}' for user ${userId} with payload: ${JSON.stringify(actionObject)}`);
            try {
                const result = await handler(userId, actionObject, sessionId); // Pass sessionId to handler
                metrics.incActionDispatch(sessionId, action, result.success ? 'success' : 'failure');
                auditService.logActionDispatch(userId, sessionId, actionObject, result.success ? 'success' : 'failure', result);
                return result;
            } catch (error) {
                this.logger.error(`Error executing action '${action}' for user ${userId}: ${error.message}`);
                metrics.incActionDispatch(sessionId, action, 'error');
                auditService.logActionDispatch(userId, sessionId, actionObject, 'error', error.message);
                return { success: false, message: `Error executing action: ${error.message}` };
            }
        } else {
            const message = `No handler found for action: ${action}`;
            this.logger.warn(message);
            metrics.incActionDispatch(sessionId, action, 'failure');
            auditService.logActionDispatch(userId, sessionId, actionObject, 'failure', message);
            return { success: false, message: message };
        }
    }

    /**
     * Maps an action type to its required permission.
     * @param {string} action - The action type (e.g., 'OPEN_APP').
     * @returns {string|null} The required permission string, or null if no specific permission is required.
     */
    _getRequiredPermissionForAction(action) {
        // This mapping can be expanded as more actions are added
        switch (action) {
            case 'OPEN_APP': return 'system:control';
            case 'SEARCH_WEB': return 'system:read';
            case 'SET_TIMER': return 'utility:timer';
            case 'CONTROL_VOLUME': return 'system:control';
            default: return null;
        }
    }

    /**
     * Dispatches an action to the Electron frontend for execution.
     * The backend just relays the instruction.
     * @param {string} userId - The ID of the user.
     * @param {Object} actionObject - The action to be sent to Electron.
     * @param {string} [sessionId] - The ID of the current session.
     */
    async _dispatchToElectron(userId, actionObject, sessionId = null) {
        this.logger.debug(`[ActionDispatcher] Sending action to Electron for user ${userId}, session ${sessionId}: ${JSON.stringify(actionObject)}`);
        electronComm.sendActionInstructions(sessionId, actionObject);
        return { success: true, message: `Action '${actionObject.action}' dispatched to Electron.` };
    }

    // Example of a handler for a direct system command (less secure, use with extreme caution)
    // async _handleDirectSystemCommand(userId, actionObject) {
    //     this.logger.warn(`[ActionDispatcher] Executing DIRECT_SYSTEM_COMMAND: ${JSON.stringify(actionObject)} for user ${userId}`);
    //     // This would directly call systemExecutor
    //     return systemExecutor.execute(actionObject);
    // }
}

module.exports = new ActionDispatcher();
