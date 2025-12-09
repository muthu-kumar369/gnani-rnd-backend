import { createContextualLogger } from './logger.js';
import metrics from '../monitoring/metrics.js';

const logger = createContextualLogger({ module: 'SecurityAudit' });

export interface SecurityEvent {
    event: string;
    severity: 'info' | 'warning' | 'critical';
    userId?: string;
    sessionId?: string;
    metadata?: any;
    timestamp: string;
}

export class SecurityAuditService {
    /**
     * Log authentication attempt
     */
    logAuthAttempt(userId: string, success: boolean, metadata?: any): void {
        logger.info('Authentication attempt', {
            userId,
            success,
            timestamp: new Date().toISOString(),
            ...metadata,
        });

        if (!success) {
            metrics.incrementErrors('auth_failed', 'authentication');
        }
    }

    /**
     * Log rate limit exceeded
     */
    logRateLimitExceeded(endpoint: string, userId: string, metadata?: any): void {
        logger.warn('Rate limit exceeded', {
            endpoint,
            userId,
            timestamp: new Date().toISOString(),
            ...metadata,
        });

        metrics.incrementRateLimitExceeded(endpoint);
    }

    /**
     * Log PII detected
     */
    logPIIDetected(userId: string, piiType: string, masked: boolean, context?: string): void {
        logger.info('PII detected', {
            userId,
            piiType,
            masked,
            context,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Log content filtered
     */
    logContentFiltered(userId: string, reason: string, categories: string[], metadata?: any): void {
        logger.warn('Content filtered', {
            userId,
            reason,
            categories,
            timestamp: new Date().toISOString(),
            ...metadata,
        });
    }

    /**
     * Log security event
     */
    logSecurityEvent(event: string, severity: 'info' | 'warning' | 'critical', metadata?: any): void {
        const logData = {
            event,
            severity,
            timestamp: new Date().toISOString(),
            ...metadata,
        };

        switch (severity) {
            case 'critical':
                logger.error(`Security event: ${event}`, logData);
                metrics.incrementErrors('security_critical', 'security');
                break;
            case 'warning':
                logger.warn(`Security event: ${event}`, logData);
                metrics.incrementErrors('security_warning', 'security');
                break;
            default:
                logger.info(`Security event: ${event}`, logData);
        }
    }

    /**
     * Log unauthorized access attempt
     */
    logUnauthorizedAccess(userId: string, resource: string, action: string): void {
        logger.warn('Unauthorized access attempt', {
            userId,
            resource,
            action,
            timestamp: new Date().toISOString(),
        });

        metrics.incrementErrors('unauthorized_access', 'security');
    }

    /**
     * Log input validation failure
     */
    logValidationFailure(endpoint: string, errors: any[], userId?: string): void {
        logger.warn('Input validation failed', {
            endpoint,
            errors,
            userId,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Log suspicious activity
     */
    logSuspiciousActivity(userId: string, activity: string, metadata?: any): void {
        logger.warn('Suspicious activity detected', {
            userId,
            activity,
            timestamp: new Date().toISOString(),
            ...metadata,
        });

        metrics.incrementErrors('suspicious_activity', 'security');
    }

    /**
     * Log data access
     */
    logDataAccess(userId: string, dataType: string, action: 'read' | 'write' | 'delete', metadata?: any): void {
        logger.info('Data access', {
            userId,
            dataType,
            action,
            timestamp: new Date().toISOString(),
            ...metadata,
        });
    }
}

// Singleton instance
export const securityAudit = new SecurityAuditService();
