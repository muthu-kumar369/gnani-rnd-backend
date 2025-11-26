// src/routes/userRoutes.ts
import express from 'express';
import userController from './user.controller.js';
import { authMiddleware } from '../../core/security/auth.middleware.js';

const router = express.Router();

// User Profile & Settings Routes (Protected)
router.get('/profile', authMiddleware, userController.getProfile.bind(userController));
router.put('/profile', authMiddleware, userController.updateProfile.bind(userController));
router.get('/settings', authMiddleware, userController.getSettings.bind(userController));
router.put('/settings', authMiddleware, userController.updateSettings.bind(userController));
router.get('/devices', authMiddleware, userController.getDevices.bind(userController));
router.post('/devices', authMiddleware, userController.addDevice.bind(userController));
router.put('/devices/:deviceId', authMiddleware, userController.updateDevice.bind(userController));
router.delete('/devices/:deviceId', authMiddleware, userController.removeDevice.bind(userController));

// Security Routes
router.get('/security', authMiddleware, userController.getSecurity.bind(userController));
router.put('/security', authMiddleware, userController.updateSecurity.bind(userController));

// OAuth Routes
router.get('/oauth', authMiddleware, userController.getOAuthProviders.bind(userController));
router.delete('/oauth/:provider', authMiddleware, userController.unlinkOAuthProvider.bind(userController));

// History Routes
router.get('/history', authMiddleware, userController.getHistory.bind(userController));
router.delete('/history/:id', authMiddleware, userController.deleteHistoryItem.bind(userController));
router.delete('/history', authMiddleware, userController.clearHistory.bind(userController));

// Notes Routes
router.get('/notes', authMiddleware, userController.getNotes.bind(userController));
router.post('/notes', authMiddleware, userController.addNote.bind(userController));
router.delete('/notes/:index', authMiddleware, userController.deleteNote.bind(userController));

export default router;
