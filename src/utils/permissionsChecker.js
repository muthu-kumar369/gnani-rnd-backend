// src/utils/permissionsChecker.js
const logger = require('./logger');

class PermissionsChecker {
    constructor() {
        // Define default roles and their associated permissions
        this.rolePermissions = {
            owner: ['system:*', 'user:*', 'settings:*', 'admin:*'], // Full access
            admin: ['system:read', 'system:control', 'user:read', 'user:manage', 'settings:read'],
            user: ['system:read', 'settings:read', 'settings:update'],
            guest: ['system:read'], // Very limited access
        };
        logger.info('PermissionsChecker initialized.');
    }

    /**
     * Checks if a user has permission for a specific action.
     * @param {Array<string>} userRoles - Array of roles assigned to the user.
     * @param {Array<string>} userPermissions - Array of explicit permissions assigned to the user.
     * @param {string} requiredPermission - The permission string to check (e.g., 'system:control', 'user:read').
     * @returns {boolean} True if the user has the required permission, false otherwise.
     */
    checkPermission(userRoles, userPermissions, requiredPermission) {
        // Combine role-based permissions with explicit user permissions
        const effectivePermissions = new Set(userPermissions);
        userRoles.forEach(role => {
            if (this.rolePermissions[role]) {
                this.rolePermissions[role].forEach(perm => effectivePermissions.add(perm));
            }
        });

        // Check for exact match or wildcard match
        const hasPermission = effectivePermissions.has(requiredPermission) || effectivePermissions.has('*') || this._checkWildcardPermission(effectivePermissions, requiredPermission);

        if (!hasPermission) {
            logger.warn(`Permission denied: User with roles [${userRoles.join(', ')}] and permissions [${userPermissions.join(', ')}] tried to access ${requiredPermission}`);
        }
        return hasPermission;
    }

    /**
     * Internal helper to check for wildcard permissions.
     * @param {Set<string>} effectivePermissions - Set of all effective permissions.
     * @param {string} requiredPermission - The permission to check.
     * @returns {boolean} True if a wildcard matches the required permission.
     */
    _checkWildcardPermission(effectivePermissions, requiredPermission) {
        const parts = requiredPermission.split(':');
        if (parts.length > 1) {
            const domainWildcard = parts[0] + ':*';
            if (effectivePermissions.has(domainWildcard)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Checks if a user has at least one of the specified roles.
     * @param {Array<string>} userRoles - Array of roles assigned to the user.
     * @param {Array<string>} requiredRoles - Array of roles required.
     * @returns {boolean} True if the user has at least one of the required roles, false otherwise.
     */
    checkRole(userRoles, requiredRoles) {
        return userRoles.some(role => requiredRoles.includes(role));
    }
}

module.exports = new PermissionsChecker();
