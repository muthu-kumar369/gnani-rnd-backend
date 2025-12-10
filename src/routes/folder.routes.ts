import { Router, Request, Response } from 'express';
import Folder from '../models/folder.model.js';
import { authMiddleware, type CustomRequest } from '../core/security/auth.middleware.js';
import { createContextualLogger } from '../core/logger/logger.js';

const router = Router();
const logger = createContextualLogger({ module: 'FolderRoutes' });

// GET /api/folders - Get all folders for user
router.get('/', authMiddleware, async (req: CustomRequest, res: Response) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const folders = await Folder.find({ userId }).sort({ updatedAt: -1 });

        res.json({ folders });
    } catch (error) {
        logger.error('Failed to fetch folders', error as Error);
        res.status(500).json({ error: 'Failed to fetch folders' });
    }
});

// POST /api/folders - Create new folder
router.post('/', authMiddleware, async (req: CustomRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { name, color, icon } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!name) {
            return res.status(400).json({ error: 'Folder name is required' });
        }

        const folder = await Folder.create({
            userId,
            name,
            color: color || '#22d3ee',
            icon: icon || '📁',
            conversationIds: [],
        });

        logger.info(`Folder created: ${folder._id}`);

        res.status(201).json({ folder });
    } catch (error) {
        logger.error('Failed to create folder', error as Error);
        res.status(500).json({ error: 'Failed to create folder' });
    }
});

// PATCH /api/folders/:folderId - Update folder
router.patch('/:folderId', authMiddleware, async (req: CustomRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { folderId } = req.params;
        const { name, color, icon } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const folder = await Folder.findOneAndUpdate(
            { _id: folderId, userId },
            { $set: { name, color, icon } },
            { new: true }
        );

        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        logger.info(`Folder updated: ${folderId}`);

        res.json({ folder });
    } catch (error) {
        logger.error('Failed to update folder', error as Error);
        res.status(500).json({ error: 'Failed to update folder' });
    }
});

// DELETE /api/folders/:folderId - Delete folder
router.delete('/:folderId', authMiddleware, async (req: CustomRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { folderId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const folder = await Folder.findOneAndDelete({ _id: folderId, userId });

        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        logger.info(`Folder deleted: ${folderId}`);

        res.json({ success: true });
    } catch (error) {
        logger.error('Failed to delete folder', error as Error);
        res.status(500).json({ error: 'Failed to delete folder' });
    }
});

// POST /api/folders/:folderId/conversations/:conversationId - Add conversation to folder
router.post('/:folderId/conversations/:conversationId', authMiddleware, async (req: CustomRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { folderId, conversationId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const folder = await Folder.findOneAndUpdate(
            { _id: folderId, userId },
            { $addToSet: { conversationIds: conversationId } },
            { new: true }
        );

        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        logger.info(`Conversation ${conversationId} added to folder ${folderId}`);

        res.json({ folder });
    } catch (error) {
        logger.error('Failed to add conversation to folder', error as Error);
        res.status(500).json({ error: 'Failed to add conversation to folder' });
    }
});

// DELETE /api/folders/:folderId/conversations/:conversationId - Remove conversation from folder
router.delete('/:folderId/conversations/:conversationId', authMiddleware, async (req: CustomRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { folderId, conversationId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const folder = await Folder.findOneAndUpdate(
            { _id: folderId, userId },
            { $pull: { conversationIds: conversationId } },
            { new: true }
        );

        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        logger.info(`Conversation ${conversationId} removed from folder ${folderId}`);

        res.json({ folder });
    } catch (error) {
        logger.error('Failed to remove conversation from folder', error as Error);
        res.status(500).json({ error: 'Failed to remove conversation from folder' });
    }
});

export default router;
