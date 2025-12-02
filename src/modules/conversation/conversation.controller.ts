import { Request, Response } from 'express';
import conversationService from './conversation.service.js';

// Extend Request type to include user
interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
    };
}

class ConversationController {
    async listConversations(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const result = await conversationService.listConversations(userId, req.query);
            res.json(result);
        } catch (error) {
            console.error('Error listing conversations:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    async getConversation(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const { id } = req.params;
            const conversation = await conversationService.getConversation(id, userId);

            if (!conversation) {
                return res.status(404).json({ error: 'Conversation not found' });
            }

            res.json(conversation);
        } catch (error) {
            console.error('Error getting conversation:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    async searchConversations(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const { query, limit } = req.body;
            if (!query) return res.status(400).json({ error: 'Query is required' });

            const results = await conversationService.searchConversations(userId, query, limit);
            res.json({ conversations: results });
        } catch (error) {
            console.error('Error searching conversations:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    async deleteConversation(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const { id } = req.params;
            const result = await conversationService.deleteConversation(id, userId);

            if (!result) {
                return res.status(404).json({ error: 'Conversation not found' });
            }

            res.json({ message: 'Conversation deleted successfully' });
        } catch (error) {
            console.error('Error deleting conversation:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    async updateTitle(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const { id } = req.params;
            const { title } = req.body;

            if (!title) return res.status(400).json({ error: 'Title is required' });

            const result = await conversationService.updateTitle(id, userId, title);

            if (!result) {
                return res.status(404).json({ error: 'Conversation not found' });
            }

            res.json(result);
        } catch (error) {
            console.error('Error updating title:', error);
            res.status(500).json({ error: 'Internal Server Error' });
    }
    }

    async regenerateResponse(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const { id } = req.params;
            const { messageId } = req.body;

            if (!messageId) return res.status(400).json({ error: 'Message ID is required' });

            const result = await conversationService.regenerateResponse(id, messageId, userId);
            res.json(result);
        } catch (error: any) {
            console.error('Error regenerating response:', error);
            res.status(500).json({ error: error.message || 'Internal Server Error' });
        }
    }

    async editMessage(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const { id } = req.params;
            const { messageId, content } = req.body;

            if (!messageId || !content) return res.status(400).json({ error: 'Message ID and content are required' });

            const result = await conversationService.editMessage(id, messageId, content, userId);
            res.json(result);
        } catch (error: any) {
            console.error('Error editing message:', error);
            res.status(500).json({ error: error.message || 'Internal Server Error' });
        }
    }
}

export default new ConversationController();
