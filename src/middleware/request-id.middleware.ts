// src/middleware/request-id.middleware.ts
// Stage 5: Request ID middleware for request correlation
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
    // Extract request ID from header or generate new one
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();

    // Attach to request object for use in handlers
    (req as any).requestId = requestId;

    // Set response header for client correlation
    res.setHeader('X-Request-ID', requestId);

    next();
}
