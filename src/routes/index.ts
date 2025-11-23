// src/routes/index.ts
import express from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import userRoutes from '../modules/user/user.routes.js';
import statusRoutes from './health.routes.js';
import adminRoutes from '../modules/admin/admin.routes.js';

const router = express.Router();

// Mount individual routers
router.use('/auth', authRoutes);     // Routes for /api/auth/...
router.use('/user', userRoutes);     // Routes for /api/user/...
router.use('/status', statusRoutes); // Routes for /api/status/...
router.use('/admin', adminRoutes);   // Routes for /api/admin/...

export default router;
