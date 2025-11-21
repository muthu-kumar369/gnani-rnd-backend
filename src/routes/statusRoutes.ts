// src/routes/statusRoutes.ts
import express, { Request, Response } from 'express';
import logger from '../utils/logger.js';

const router = express.Router();

// Status endpoint (can be public)
router.get('/', (req: Request, res: Response) => {
    logger.info('Status endpoint hit');
    res.status(200).send('OK');
});

export default router;
