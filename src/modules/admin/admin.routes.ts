// src/routes/adminRoutes.ts
import express, { Request, Response } from 'express';
import { authMiddleware, authorizeRoles } from '../../core/security/auth.middleware.js';
import circuitBreakerRoutes from './circuit-breaker.routes.js';

const router = express.Router();

// Example of a role-protected route
router.get('/dashboard', authMiddleware, authorizeRoles('admin', 'owner'), (req: Request, res: Response) => {
    res.status(200).json({ message: 'Welcome to the Admin Dashboard!' });
});

// Stage 2: Circuit breaker routes
router.use('/', circuitBreakerRoutes);

export default router;
