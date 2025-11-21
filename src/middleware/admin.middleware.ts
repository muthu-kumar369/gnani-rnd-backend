// src/middleware/admin.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { CustomRequest } from '../core/security/auth.middleware.js'; // Assuming CustomRequest interface is defined here or similar

const adminMiddleware = (req: CustomRequest, res: Response, next: NextFunction) => {
    if (!req.fullUser || !req.fullUser.roles || !req.fullUser.roles.includes('admin')) {
        return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }
    next();
};

export default adminMiddleware;