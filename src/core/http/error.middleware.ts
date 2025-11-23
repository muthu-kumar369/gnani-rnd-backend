// backend/src/utils/error_handler.ts
import { Request, Response, NextFunction } from 'express';
import logger from '../logger/logger.js';

interface AppError extends Error {
    statusCode?: number;
}

function errorHandler(err: AppError, req: Request, res: Response, next: NextFunction): void {
    logger.error(`Error: ${err.message}, Stack: ${err.stack}`);

    const statusCode = err.statusCode || 500;
    const message = err.message || 'An unexpected error occurred';

    res.status(statusCode).json({
        status: 'error',
        statusCode,
        message
    });
}

export default errorHandler;
