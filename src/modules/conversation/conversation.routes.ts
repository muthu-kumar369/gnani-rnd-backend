import express from 'express';
import conversationController from './conversation.controller.js';
import { authMiddleware } from '../../core/security/auth.middleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// List conversations
router.get('/', conversationController.listConversations);

// Search conversations
router.post('/search', conversationController.searchConversations);

// Get single conversation
router.get('/:id', conversationController.getConversation);

// Delete conversation
router.delete('/:id', conversationController.deleteConversation);

// Update title
router.patch('/:id/title', conversationController.updateTitle);

// Regenerate response
router.post('/:id/regenerate', conversationController.regenerateResponse);

// Edit message
router.post('/:id/edit', conversationController.editMessage);

// Delete message
router.delete('/:id/messages/:messageId', conversationController.deleteMessage);

// Get prompt templates
router.get('/prompt-templates', conversationController.getPromptTemplates);

// Update system prompt
router.patch('/:id/system-prompt', conversationController.updateSystemPrompt);

// Export conversation
router.get('/:sessionId/export/markdown', conversationController.exportMarkdown);
router.get('/:sessionId/export/json', conversationController.exportJson);

export default router;
