import { Request, Response } from 'express';
import conversationService from './conversation.service.js';
import exportService from './export.service.js';
import { PROMPT_TEMPLATES } from '../../data/prompt-templates.js';

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

    async createConversation(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const { systemPrompt } = req.body;
            const conversation = await conversationService.createConversation(userId, systemPrompt);
            res.status(201).json(conversation);
        } catch (error) {
            console.error('Error creating conversation:', error);
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
            const { messageId, content, autoRegenerate = true } = req.body;

            if (!messageId || !content) return res.status(400).json({ error: 'Message ID and content are required' });

            const result = await conversationService.editMessage(id, messageId, content, userId, autoRegenerate);
            res.json(result);
        } catch (error: any) {
            console.error('Error editing message:', error);

            // Handle role validation errors
            if (error.message.includes('Cannot edit assistant messages')) {
                return res.status(400).json({ error: error.message });
            }

            res.status(500).json({ error: error.message || 'Internal Server Error' });
        }
    }

    async getMessageGenerations(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const { id, messageId } = req.params;

            const result = await conversationService.getMessageGenerations(id, messageId, userId);
            res.json(result);
        } catch (error: any) {
            console.error('Error getting message generations:', error);
            res.status(500).json({ error: error.message || 'Internal Server Error' });
        }
    }

    async deleteMessage(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const { id, messageId } = req.params;

            if (!messageId) return res.status(400).json({ error: 'Message ID is required' });

            const result = await conversationService.deleteMessage(id, messageId, userId);
            res.json(result);
        } catch (error: any) {
            console.error('Error deleting message:', error);

            // Handle role validation errors
            if (error.message.includes('Cannot delete assistant messages')) {
                return res.status(400).json({ error: error.message });
            }

            res.status(500).json({ error: error.message || 'Internal Server Error' });
        }
    }

    async restoreMessage(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const { messageId } = req.params;
            const { undoToken } = req.body;

            if (!messageId || !undoToken) {
                return res.status(400).json({ error: 'Message ID and undo token are required' });
            }

            const result = await conversationService.restoreMessage(messageId, undoToken, userId);
            res.json(result);
        } catch (error: any) {
            console.error('Error restoring message:', error);

            if (error.message.includes('expired') || error.message.includes('invalid')) {
                return res.status(400).json({ error: error.message });
            }

            res.status(500).json({ error: error.message || 'Internal Server Error' });
        }
    }

    async cancelStream(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const { id } = req.params;
            const { messageId } = req.body;

            // Import sessionCoordinator
            const { default: sessionCoordinator } = await import('../session/session.coordinator.js');

            const cancelled = await sessionCoordinator.cancelStream(id, messageId);

            if (cancelled) {
                res.json({ success: true, message: 'Stream cancelled successfully' });
            } else {
                res.status(404).json({ error: 'Session not found or not streaming' });
            }
        } catch (error: any) {
            console.error('Error cancelling stream:', error);
            res.status(500).json({ error: error.message || 'Internal Server Error' });
        }
    }

    async sendMessage(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const { id } = req.params;
            const { content } = req.body;

            if (!content) return res.status(400).json({ error: 'Content is required' });

            const result = await conversationService.sendMessage(id, userId, content);
            res.json(result);
        } catch (error: any) {
            console.error('Error sending message:', error);
            res.status(500).json({ error: error.message || 'Internal Server Error' });
        }
    }

    async getPromptTemplates(req: AuthenticatedRequest, res: Response) {
        try {
            res.json({ templates: PROMPT_TEMPLATES });
        } catch (error) {
            console.error('Error getting prompt templates:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    async updateSystemPrompt(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const { id } = req.params;
            const { systemPrompt } = req.body;

            if (!systemPrompt || typeof systemPrompt !== 'string') {
                return res.status(400).json({ error: 'systemPrompt is required and must be a string' });
            }

            if (systemPrompt.length > 2000) {
                return res.status(400).json({ error: 'systemPrompt must be less than 2000 characters' });
            }

            const result = await conversationService.updateSystemPrompt(id, userId, systemPrompt);

            if (!result) {
                return res.status(404).json({ error: 'Conversation not found' });
            }

            res.json(result);
        } catch (error) {
            console.error('Error updating system prompt:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    async updateTemplate(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const { id } = req.params;
            const { templateId } = req.body;

            if (!templateId) {
                return res.status(400).json({ error: 'templateId is required' });
            }

            const result = await conversationService.updateConversationTemplate(id, userId, templateId);

            if (!result) {
                return res.status(404).json({ error: 'Conversation not found' });
            }

            res.json(result);
        } catch (error) {
            console.error('Error updating template:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    async updateModel(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const { id } = req.params;
            const { modelId } = req.body;

            if (!modelId) {
                return res.status(400).json({ error: 'modelId is required' });
            }

            const result = await conversationService.updateConversationModel(id, userId, modelId);

            if (!result) {
                return res.status(404).json({ error: 'Conversation not found' });
            }

            res.json(result);
        } catch (error) {
            console.error('Error updating model:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    async exportMarkdown(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const { id } = req.params;
            const markdown = await exportService.exportToMarkdown(id, userId);

            // Set headers for file download
            const filename = `conversation-${id}-${Date.now()}.md`;
            res.setHeader('Content-Type', 'text/markdown');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(markdown);
        } catch (error: any) {
            console.error('Error exporting to markdown:', error);
            if (error.message === 'Conversation not found') {
                return res.status(404).json({ error: 'Conversation not found' });
            }
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    async exportJson(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            const { id } = req.params;
            const data = await exportService.exportToJson(id, userId);

            // Set headers for file download
            const filename = `conversation-${id}-${Date.now()}.json`;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.json(data);
        } catch (error: any) {
            console.error('Error exporting to JSON:', error);
            if (error.message === 'Conversation not found') {
                return res.status(404).json({ error: 'Conversation not found' });
            }
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}

export default new ConversationController();
