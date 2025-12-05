import { Response } from 'express';
import { CustomRequest } from '../../core/security/auth.middleware.js';
import { templateService } from './template.service.js';

export class TemplateController {
    async create(req: CustomRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const template = await templateService.create(req.body, userId);
            res.status(201).json(template);
        } catch (error) {
            console.error('Error creating template:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    async findAll(req: CustomRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const templates = await templateService.findAll(userId);
            res.json(templates);
        } catch (error) {
            console.error('Error fetching templates:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    async update(req: CustomRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const { id } = req.params;

            console.log('[TemplateController] Update request:', {
                templateId: id,
                userId: userId,
                body: req.body
            });

            // Check if template exists first
            const existingTemplate = await templateService.findById(id, userId);
            console.log('[TemplateController] Existing template:', existingTemplate);

            const template = await templateService.update(id, userId, req.body);

            if (!template) {
                console.log('[TemplateController] Update failed - template not found or unauthorized');
                return res.status(404).json({ error: 'Template not found or unauthorized' });
            }

            console.log('[TemplateController] Template updated successfully:', template);
            res.json(template);
        } catch (error) {
            console.error('Error updating template:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    async delete(req: CustomRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const { id } = req.params;
            const success = await templateService.delete(id, userId);

            if (!success) {
                return res.status(404).json({ error: 'Template not found or unauthorized' });
            }

            res.json({ message: 'Template deleted successfully' });
        } catch (error) {
            console.error('Error deleting template:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}

export const templateController = new TemplateController();
