// src/controllers/authController.ts
import { Request, Response, NextFunction } from 'express';
import authService from '../services/authService.js';
import { createContextualLogger } from '../utils/logger.js'; // Import logger factory
import auditService from '../services/auditService.js'; // Import audit service
import errorHandler from '../utils/error_handler.js';
import { Logger } from 'winston';

class AuthController {
    private logger: Logger;

    constructor() {
        this.logger = createContextualLogger({ module: 'AuthController' }); // Create a logger instance
    }

    async register(req: Request, res: Response, next: NextFunction): Promise<void> {
        const { username, email, password } = req.body;
        try {
            const user = await authService.registerUser({ username, email, password });
            auditService.logAuthEvent(user.userId, 'REGISTER', 'success', { username, email });
            res.status(201).json({ message: 'User registered successfully', userId: user.userId });
        } catch (error: any) {
            this.logger.error(`Registration error for ${username || email}: ${error.message}`);
            auditService.logAuthEvent(null, 'REGISTER', 'failure', { username, email, error: error.message });
            next(error); // Pass error to centralized error handler
        }
    }

    async login(req: Request, res: Response, next: NextFunction): Promise<void> {
        const { loginIdentifier, password } = req.body;
        try {
            const { token, user } = await authService.loginUser(loginIdentifier, password);
            auditService.logAuthEvent(user.userId, 'LOGIN', 'success', { loginIdentifier });
            res.status(200).json({ message: 'Login successful', token, user });
        } catch (error: any) {
            this.logger.error(`Login error for ${loginIdentifier}: ${error.message}`);
            auditService.logAuthEvent(null, 'LOGIN', 'failure', { loginIdentifier, error: error.message });
            next(error); // Pass error to centralized error handler
        }
    }
}

export default new AuthController();
