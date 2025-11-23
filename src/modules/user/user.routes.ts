// src/routes/userRoutes.ts
import express from 'express';
import userController from './user.controller.js';
import { authMiddleware } from '../../core/security/auth.middleware.js';

const router = express.Router();

// User Profile & Settings Routes (Protected)
router.get('/profile', authMiddleware, userController.getProfile.bind(userController));
router.put('/settings', authMiddleware, userController.updateSettings.bind(userController));
router.get('/devices', authMiddleware, userController.getDevices.bind(userController));
router.post('/devices', authMiddleware, userController.addDevice.bind(userController));
router.put('/devices/:deviceId', authMiddleware, userController.updateDevice.bind(userController));

export default router;
