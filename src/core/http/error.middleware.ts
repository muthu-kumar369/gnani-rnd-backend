// backend/src/utils/error_handler.ts
import { Request, Response, NextFunction } from 'express';
import logger from '../logger/logger.js';

interface AppError extends Error {
    statusCode?: number;
}

function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'An unexpected error occurred';
    
    // Log the error with context
    logger.error(`[${req.method}] ${req.originalUrl} - Error: ${message}`, {
        stack: err.stack,
        ip: req.ip,
        statusCode,
        userId: (req as any).userId // Log user ID if available
    });

    // Operational errors (trusted) vs Programmer errors (bugs)
    // In production, don't leak stack traces for 500s
    const isProduction = process.env.NODE_ENV === 'production';

    res.status(statusCode).json({
        status: 'error',
        statusCode,
        message: statusCode === 500 && isProduction ? 'Internal Server Error' : message,
        ...(isProduction ? {} : { stack: err.stack })
    });
}

export default errorHandler;
