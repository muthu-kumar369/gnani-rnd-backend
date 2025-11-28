// src/routes/authRoutes.ts
import { Router } from 'express';
import authController from './auth.controller.js';
import { authMiddleware } from '../../core/security/auth.middleware.js';
import { authLimiter, oauthStartLimiter, oauthCallbackLimiter, oauthLinkLimiter } from '../../config/rate-limit.config.js';

const router = Router();

// Auth Routes
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/refresh-token', authLimiter, authController.refreshToken);
router.post('/logout', authMiddleware, authController.logout);

// OAuth Routes
router.post('/oauth', authLimiter, authController.oauth); // Backward compatibility
router.get('/oauth/:provider/start', oauthStartLimiter, authController.startOAuth);
router.get('/oauth/callback', oauthCallbackLimiter, authController.oauthCallback);
router.post('/oauth/link/:provider', authMiddleware, oauthLinkLimiter, authController.linkOAuthProvider);
router.delete('/oauth/unlink/:provider', authMiddleware, oauthLinkLimiter, authController.unlinkOAuthProvider);

export default router;
