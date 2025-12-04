import { Router } from 'express';
import { toolController } from './tool.controller.js';
import { authMiddleware as authenticate } from '../../core/security/auth.middleware.js';

import { validate } from '../../middleware/zod.middleware.js';
import { toggleToolSchema, updateToolConfigSchema } from '../../schemas/tool.schema.js';

const router = Router();

router.use(authenticate);

router.get('/', (req, res) => toolController.findAll(req, res));
router.patch('/:id/toggle', validate(toggleToolSchema), (req, res) => toolController.toggle(req, res));
router.patch('/:id/config', validate(updateToolConfigSchema), (req, res) => toolController.updateConfig(req, res));

export default router;
