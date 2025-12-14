// src/routes/userRoutes.ts
import express from 'express';
import userController from './user.controller.js';
import { authMiddleware } from '../../core/security/auth.middleware.js';
import { cacheMiddleware } from '../../middleware/cache.middleware.js';

const router = express.Router();

// Current User Route (5 min cache)
router.get('/me', authMiddleware, cacheMiddleware({ ttl: 300 }), userController.getMe.bind(userController));

// User Profile & Settings Routes (Protected)
router.get('/profile', authMiddleware, cacheMiddleware({ ttl: 600 }), userController.getProfile.bind(userController)); // 10 min
router.put('/profile', authMiddleware, userController.updateProfile.bind(userController));
router.get('/voices', authMiddleware, userController.getVoices.bind(userController));
router.get('/settings', authMiddleware, cacheMiddleware({ ttl: 600 }), userController.getSettings.bind(userController)); // 10 min
router.put('/settings', authMiddleware, userController.updateSettings.bind(userController));
router.get('/preferences', authMiddleware, cacheMiddleware({ ttl: 600 }), userController.getPreferences.bind(userController)); // 10 min
router.patch('/preferences', authMiddleware, userController.updatePreferences.bind(userController));
// Security Routes (10 min cache)
router.get('/security', authMiddleware, cacheMiddleware({ ttl: 600 }), userController.getSecurity.bind(userController));
router.put('/security', authMiddleware, userController.updateSecurity.bind(userController));

// OAuth Routes (10 min cache)
router.get('/oauth', authMiddleware, cacheMiddleware({ ttl: 600 }), userController.getOAuthProviders.bind(userController));
router.delete('/oauth/:provider', authMiddleware, userController.unlinkOAuthProvider.bind(userController));

// Notes Routes (5 min cache)
router.get('/notes', authMiddleware, cacheMiddleware({ ttl: 300 }), userController.getNotes.bind(userController));
router.post('/notes', authMiddleware, userController.addNote.bind(userController));
router.delete('/notes/:index', authMiddleware, userController.deleteNote.bind(userController));

export default router;


