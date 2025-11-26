// src/routes/authRoutes.ts
import express from 'express';
import authController from './auth.controller.js';

const   router = express.Router();

// Auth Routes
router.post('/register', authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));
router.post('/oauth', authController.oauth.bind(authController));

export default router;
