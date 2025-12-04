import { Response } from 'express';
import { CustomRequest } from '../../core/security/auth.middleware.js';
import { toolService } from './tool.service.js';

export class ToolController {
    async findAll(req: CustomRequest, res: Response) {
        try {
            const tools = await toolService.findAll();
            res.json(tools);
        } catch (error) {
            console.error('Error fetching tools:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    async toggle(req: CustomRequest, res: Response) {
        try {
            // Only admins should be able to toggle system tools? For now, any auth user.
            const { id } = req.params;
            const { isEnabled } = req.body;

            if (typeof isEnabled !== 'boolean') {
                return res.status(400).json({ error: 'isEnabled must be a boolean' });
            }

            const tool = await toolService.toggleTool(id, isEnabled);
            
            if (!tool) {
                return res.status(404).json({ error: 'Tool not found' });
            }

            res.json(tool);
        } catch (error) {
            console.error('Error toggling tool:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    async updateConfig(req: CustomRequest, res: Response) {
        try {
            const { id } = req.params;
            const { config } = req.body;

            if (!config || typeof config !== 'object') {
                return res.status(400).json({ error: 'config must be an object' });
            }

            const tool = await toolService.updateConfig(id, config);

            if (!tool) {
                return res.status(404).json({ error: 'Tool not found' });
            }

            res.json(tool);
        } catch (error) {
            console.error('Error updating tool config:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}

export const toolController = new ToolController();
