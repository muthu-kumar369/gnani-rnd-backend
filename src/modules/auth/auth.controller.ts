import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { OAuthService } from './oauth.service.js';
import { createContextualLogger } from '../../core/logger/logger.js';
import auditService from '../../core/logger/audit.service.js';

const logger = createContextualLogger({ module: 'AuthController' });
const authService = new AuthService();
const oauthService = new OAuthService();

export default {
    async register(req: Request, res: Response, next: NextFunction): Promise<void> {
        const { username, email, password } = req.body;
        try {
            const user = await authService.registerUser({ username, email, password });
            auditService.logAuthEvent(user.userId, 'REGISTER', 'success', { username, email });
            res.status(201).json({ message: 'User registered successfully', userId: user.userId });
        } catch (error: any) {
            logger.error(`Registration error for ${username || email}: ${error.message}`);
            auditService.logAuthEvent(null, 'REGISTER', 'failure', { username, email, error: error.message });
            next(error);
        }
    },

    async login(req: Request, res: Response, next: NextFunction): Promise<void> {
        const { loginIdentifier, password } = req.body;
        try {
            const { token, user } = await authService.loginUser(loginIdentifier, password);
            auditService.logAuthEvent(user.userId, 'LOGIN', 'success', { loginIdentifier });
            res.status(200).json({ message: 'Login successful', token, user });
        } catch (error: any) {
            logger.error(`Login error for ${loginIdentifier}: ${error.message}`);
            auditService.logAuthEvent(null, 'LOGIN', 'failure', { loginIdentifier, error: error.message });
            next(error);
        }
    },

    async oauth(req: Request, res: Response, next: NextFunction): Promise<void> {
        const { provider, code, redirectUri } = req.body;
        try {
            const result = await oauthService.authenticate(provider, code, redirectUri);
            auditService.logAuthEvent(result.user.userId, 'OAUTH_LOGIN', 'success', { provider });
            res.status(200).json(result);
        } catch (error: any) {
            logger.error(`OAuth error for provider ${provider}: ${error.message}`);
            auditService.logAuthEvent(null, 'OAUTH_LOGIN', 'failure', { provider, error: error.message });
            next(error);
        }
    }
};
