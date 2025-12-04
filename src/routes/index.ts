// src/routes/index.ts
import express from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import userRoutes from '../modules/user/user.routes.js';
import statusRoutes from './health.routes.js';
import adminRoutes from '../modules/admin/admin.routes.js';
import conversationRoutes from '../modules/conversation/conversation.routes.js';
import fileRoutes from '../modules/file/file.routes.js';
import visionRoutes from '../modules/vision/vision.routes.js';
import llmRoutes from '../modules/llm/llm.routes.js';
// Phase 4 routes
import queueRoutes from './queue.routes.js';
import monitoringRoutes from './monitoring.routes.js';
import chatRoutes from './chat.routes.js';

const router = express.Router();

// Mount individual routers
router.use('/auth', authRoutes);     // Routes for /api/auth/...
router.use('/user', userRoutes);     // Routes for /api/user/...
router.use('/status', statusRoutes); // Routes for /api/status/...
router.use('/admin', adminRoutes);   // Routes for /api/admin/...
router.use('/conversations', conversationRoutes); // Routes for /api/conversations/...
router.use('/files', fileRoutes);     // Routes for /api/files/...
router.use('/vision', visionRoutes);   // Routes for /api/vision/...
router.use('/llm', llmRoutes);         // Routes for /api/llm/...
router.use('/chat', chatRoutes);     // Routes for /api/chat/... (Mobile/HTTP)

// Phase 4 routes
router.use('/queue', queueRoutes);         // Routes for /api/queue/...
router.use('/monitoring', monitoringRoutes); // Routes for /api/monitoring/...

export default router;

