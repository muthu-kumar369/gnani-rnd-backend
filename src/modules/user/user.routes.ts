// src/routes/userRoutes.ts
import express from 'express';
import userController from './user.controller.js';
import { authMiddleware } from '../../core/security/auth.middleware.js';

const router = express.Router();

// User Profile & Settings Routes (Protected)
router.get('/profile', authMiddleware, userController.getProfile);
router.put('/settings', authMiddleware, userController.updateSettings);
router.get('/devices', authMiddleware, userController.getDevices);
router.post('/devices', authMiddleware, userController.addDevice);
router.put('/devices/:deviceId', authMiddleware, userController.updateDevice);

export default router;
