// src/middlewares/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../config/env.config.js';
import logger from '../../core/logger/logger.js';
import User from '../../modules/user/user.entity.js';

interface DecodedToken {
    user: {
        id: string;
    };
}

export interface CustomRequest extends Request {
    user?: DecodedToken['user'];
    fullUser?: any; // Consider creating a User interface
}

export const authMiddleware = async (req: CustomRequest, res: Response, next: NextFunction): Promise<void | Response> => {
    // Get token from header or query param
    const token = req.header('x-auth-token') || req.query.token as string;

    // Check if no token
    if (!token) {
        logger.debug('Auth middleware: No token found in header or query', {
            path: req.path,
            query: req.query,
            headers: req.headers
        });
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Verify token
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
        req.user = decoded.user;

        // Optionally, fetch full user object from DB and attach
        req.fullUser = await User.findOne({ userId: req.user.id }).select('-passwordHash');
        if (!req.fullUser) {
            logger.warn(`Auth middleware: User not found for ID ${req.user.id}`);
            return res.status(401).json({ message: 'User not found, authorization denied' });
        }
        next();
    } catch (err: any) {
        logger.error(`Auth middleware error: ${err.message}`, { token: token.substring(0, 20) + '...' });
        res.status(401).json({ message: `Token is not valid: ${err.message}` });
    }
};

export const authorizeRoles = (...roles: string[]) => {
    return (req: CustomRequest, res: Response, next: NextFunction) => {
        if (!req.fullUser || !req.fullUser.roles) {
            return res.status(403).json({ message: 'Authorization denied: No roles found' });
        }
        const hasPermission = req.fullUser.roles.some((role: string) => roles.includes(role));
        if (!hasPermission) {
            return res.status(403).json({ message: 'Authorization denied: Insufficient role' });
        }
        next();
    };
};
