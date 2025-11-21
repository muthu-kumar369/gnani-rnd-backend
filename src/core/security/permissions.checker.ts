// src/utils/permissionsChecker.ts
import logger from '../logger/logger.js';

class PermissionsChecker {
    private rolePermissions: { [key: string]: string[] };

    constructor() {
        this.rolePermissions = {
            owner: ['system:*', 'user:*', 'settings:*', 'admin:*'],
            admin: ['system:read', 'system:control', 'user:read', 'user:manage', 'settings:read'],
            user: ['system:read', 'settings:read', 'settings:update'],
            guest: ['system:read'],
        };
        logger.info('PermissionsChecker initialized.');
    }

    checkPermission(userRoles: string[], userPermissions: string[], requiredPermission: string): boolean {
        const effectivePermissions = new Set(userPermissions);
        userRoles.forEach(role => {
            if (this.rolePermissions[role]) {
                this.rolePermissions[role].forEach(perm => effectivePermissions.add(perm));
            }
        });

        const hasPermission = effectivePermissions.has(requiredPermission) || effectivePermissions.has('*') || this._checkWildcardPermission(effectivePermissions, requiredPermission);

        if (!hasPermission) {
            logger.warn(`Permission denied: User with roles [${userRoles.join(', ')}] and permissions [${userPermissions.join(', ')}] tried to access ${requiredPermission}`);
        }
        return hasPermission;
    }

    private _checkWildcardPermission(effectivePermissions: Set<string>, requiredPermission: string): boolean {
        const parts = requiredPermission.split(':');
        if (parts.length > 1) {
            const domainWildcard = parts[0] + ':*';
            if (effectivePermissions.has(domainWildcard)) {
                return true;
            }
        }
        return false;
    }

    checkRole(userRoles: string[], requiredRoles: string[]): boolean {
        return userRoles.some(role => requiredRoles.includes(role));
    }
}

export default new PermissionsChecker();
