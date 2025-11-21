// src/routes/adminRoutes.ts
import express, { Request, Response } from 'express';
import { authMiddleware, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Example of a role-protected route
router.get('/dashboard', authMiddleware, authorizeRoles('admin', 'owner'), (req: Request, res: Response) => {
    res.status(200).json({ message: 'Welcome to the Admin Dashboard!' });
});

export default router;
