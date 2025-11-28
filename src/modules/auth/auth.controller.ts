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
            const { accessToken, refreshToken, user } = await authService.loginUser(loginIdentifier, password);
            auditService.logAuthEvent(user.userId || null, 'LOGIN', 'success', { loginIdentifier });
            res.status(200).json({ message: 'Login successful', accessToken, refreshToken, user });
        } catch (error: any) {
            logger.error(`Login error for ${loginIdentifier}: ${error.message}`);
            auditService.logAuthEvent(null, 'LOGIN', 'failure', { loginIdentifier, error: error.message });
            next(error);
        }
    },

    async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
        const { refreshToken } = req.body;
        const userId = (req as any).userId; // Assuming userId is available from auth middleware for convenience or a different middleware for refresh token validation

        try {
            if (!refreshToken) {
                throw new Error('Refresh token is required');
            }
            if (!userId) {
                // If userId is not available from middleware, it needs to be extracted from the refresh token itself
                // For now, we'll assume it's available or adapt later
                throw new Error('User ID not available for refresh token rotation');
            }

            const { accessToken, refreshToken: newRefreshToken } = await authService.rotateRefreshToken(refreshToken, userId);

            auditService.logAuthEvent(userId, 'REFRESH_TOKEN', 'success', { userId });
            res.status(200).json({ accessToken, refreshToken: newRefreshToken });
        } catch (error: any) {
            logger.error(`Refresh token error for user ${userId}: ${error.message}`);
            auditService.logAuthEvent(userId || null, 'REFRESH_TOKEN', 'failure', { error: error.message });
            next(error);
        }
    },

    async oauth(req: Request, res: Response, next: NextFunction): Promise<void> {
        const { provider, code, redirectUri } = req.body;
        try {
            const result = await oauthService.authenticate(provider, code, redirectUri);
            auditService.logAuthEvent(result.user.userId || null, 'OAUTH_LOGIN', 'success', { provider });
            res.status(200).json(result);
        } catch (error: any) {
            logger.error(`OAuth error for provider ${provider}: ${error.message}`);
            auditService.logAuthEvent(null, 'OAUTH_LOGIN', 'failure', { provider, error: error.message });
            next(error);
        }
    },

    async startOAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
        const { provider } = req.params;
        const { redirectUri, usePKCE } = req.query;

        try {
            const result = oauthService.generateAuthUrl(
                provider,
                redirectUri as string | undefined,
                usePKCE === 'true'
            );

            auditService.logAuthEvent(null, 'OAUTH_START', 'success', { provider });
            res.status(200).json(result);
        } catch (error: any) {
            logger.error(`OAuth start error for provider ${provider}: ${error.message}`);
            auditService.logAuthEvent(null, 'OAUTH_START', 'failure', { provider, error: error.message });
            next(error);
        }
    },

    async oauthCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
        const { provider, code, state, nonce } = req.query;

        try {
            if (!provider || !code || !state) {
                throw new Error('Missing required parameters: provider, code, or state');
            }

            const result = await oauthService.handleCallback(
                provider as string,
                code as string,
                state as string,
                nonce as string | undefined
            );

            auditService.logAuthEvent(result.user.userId || null, 'OAUTH_CALLBACK', 'success', { provider });
            res.status(200).json(result);
        } catch (error: any) {
            logger.error(`OAuth callback error: ${error.message}`);
            auditService.logAuthEvent(null, 'OAUTH_CALLBACK', 'failure', { provider, error: error.message });
            next(error);
        }
    },

    async linkOAuthProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
        const { provider } = req.params;
        const { code, redirectUri } = req.body;
        const userId = (req as any).userId; // Set by auth middleware

        try {
            if (!userId) {
                throw new Error('User not authenticated');
            }

            const result = await oauthService.linkProvider(userId, provider, code, redirectUri);

            auditService.logAuthEvent(userId, 'OAUTH_LINK', 'success', { provider });
            res.status(200).json(result);
        } catch (error: any) {
            logger.error(`OAuth link error for provider ${provider}: ${error.message}`);
            auditService.logAuthEvent((req as any).userId, 'OAUTH_LINK', 'failure', { provider, error: error.message });
            next(error);
        }
    },

    async unlinkOAuthProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
        const { provider } = req.params;
        const userId = (req as any).userId; // Set by auth middleware

        try {
            if (!userId) {
                throw new Error('User not authenticated');
            }

            const result = await oauthService.unlinkProvider(userId, provider);

            auditService.logAuthEvent(userId, 'OAUTH_UNLINK', 'success', { provider });
            res.status(200).json(result);
        } catch (error: any) {
            logger.error(`OAuth unlink error for provider ${provider}: ${error.message}`);
            auditService.logAuthEvent((req as any).userId, 'OAUTH_UNLINK', 'failure', { provider, error: error.message });
            next(error);
        }
    },

    async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
        const { refreshToken } = req.body;
        const userId = (req as any).userId;

        try {
            if (refreshToken && userId) {
                await authService.logoutUser(userId, refreshToken);
            }
            auditService.logAuthEvent(userId || null, 'LOGOUT', 'success');
            res.status(200).json({ message: 'Logged out successfully' });
        } catch (error: any) {
            logger.error(`Logout error: ${error.message}`);
            // Even if backend logout fails, we return success so frontend can clear tokens
            res.status(200).json({ message: 'Logged out successfully' });
        }
    }
};
