import { Router } from 'express';
import { templateController } from './template.controller.js';
import { authMiddleware as authenticate } from '../../core/security/auth.middleware.js';

import { validate } from '../../middleware/zod.middleware.js';
import { createTemplateSchema, updateTemplateSchema } from '../../schemas/template.schema.js';

const router = Router();

router.use(authenticate);

router.post('/', validate(createTemplateSchema), (req, res) => templateController.create(req, res));
router.get('/', (req, res) => templateController.findAll(req, res));
router.put('/:id', validate(updateTemplateSchema), (req, res) => templateController.update(req, res));
router.delete('/:id', (req, res) => templateController.delete(req, res));

export default router;
