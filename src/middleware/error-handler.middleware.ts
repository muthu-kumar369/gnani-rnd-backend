// src/middleware/error-handler.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorSeverity } from '../shared/errors/error-types.js';
import { createContextualLogger } from '../core/logger/logger.js';
import metrics from '../core/monitoring/metrics.js';

const logger = createContextualLogger({ module: 'ErrorHandler' });

export function errorHandler(
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
) {
    // Log error with context
    const context = {
        method: req.method,
        path: req.path,
        userId: (req as any).userId,
        sessionId: (req as any).sessionId,
        ip: req.ip
    };

    if (error instanceof AppError) {
        logger.error(`${error.code}: ${error.message}`, { ...context, ...error.context });

        // Increment error metrics
        metrics.errorCounter.inc({
            code: error.code,
            category: error.category,
            severity: error.severity
        });

        // Alert on critical errors
        if (error.severity === ErrorSeverity.CRITICAL) {
            // TODO: Send to alerting system (PagerDuty, Slack, etc.)
            logger.error('CRITICAL ERROR DETECTED', { error: error.toJSON(), context });
        }

        // Return appropriate HTTP status
        const statusCode = getHttpStatusCode(error);
        return res.status(statusCode).json({
            success: false,
            error: {
                code: error.code,
                message: error.message,
                severity: error.severity,
                isRetryable: error.isRetryable
            }
        });
    }

    // STAGE 17: Map errors to specific error codes for frontend
    let errorCode = 'UNKNOWN_ERROR';
    let statusCode = 500;
    let message = error.message || 'An unexpected error occurred';

    // Determine error code based on error type
    if (error.name === 'ValidationError') {
        errorCode = 'VALIDATION_ERROR';
        statusCode = 400;
    } else if (error.name === 'UnauthorizedError' || error.message?.includes('unauthorized')) {
        errorCode = 'AUTH_EXPIRED';
        statusCode = 401;
    } else if (error.message?.includes('rate limit')) {
        errorCode = 'RATE_LIMIT_EXCEEDED';
        statusCode = 429;
    } else if (error.message?.includes('not found')) {
        errorCode = 'CONVERSATION_NOT_FOUND';
        statusCode = 404;
    } else if (error.message?.includes('timeout')) {
        errorCode = 'TIMEOUT_ERROR';
        statusCode = 504;
    } else if (error.message?.includes('network')) {
        errorCode = 'NETWORK_ERROR';
        statusCode = 503;
    }

    // Unknown error
    logger.error(`Unhandled error: ${error.message}`, { ...context, stack: error.stack });
    metrics.errorCounter.inc({ code: errorCode, category: 'SYSTEM', severity: 'HIGH' });

    // STAGE 17: Send structured error response with errorCode
    res.status(statusCode).json({
        success: false,
        errorCode,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
}

function getHttpStatusCode(error: AppError): number {
    switch (error.category) {
        case 'VALIDATION':
            return 400;
        case 'AUTHENTICATION':
            return 401;
        case 'AUTHORIZATION':
            return 403;
        case 'BUSINESS_LOGIC':
            return 422;
        case 'NETWORK':
        case 'DATABASE':
        case 'EXTERNAL_SERVICE':
            return 503;
        default:
            return 500;
    }
}
