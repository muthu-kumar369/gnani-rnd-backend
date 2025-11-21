// src/routes/index.ts
import express from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import statusRoutes from './statusRoutes.js';
import adminRoutes from './adminRoutes.js';

const router = express.Router();

// Mount individual routers
router.use('/auth', authRoutes);     // Routes for /api/auth/...
router.use('/user', userRoutes);     // Routes for /api/user/...
router.use('/status', statusRoutes); // Routes for /api/status/...
router.use('/admin', adminRoutes);   // Routes for /api/admin/...

export default router;
