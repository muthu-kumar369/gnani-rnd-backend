import express from 'express';
import conversationController from './conversation.controller.js';
import { authMiddleware } from '../../core/security/auth.middleware.js';

import { validate } from '../../middleware/zod.middleware.js';
import {
    createConversationSchema,
    searchConversationSchema,
    updateConversationTitleSchema,
    editMessageSchema,
    updateSystemPromptSchema
} from '../../schemas/conversation.schema.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Create conversation
router.post('/', validate(createConversationSchema), conversationController.createConversation);

// List conversations
router.get('/', conversationController.listConversations);

// Search conversations
router.post('/search', validate(searchConversationSchema), conversationController.searchConversations);

// Get single conversation
router.get('/:id', conversationController.getConversation);

// Delete conversation
router.delete('/:id', conversationController.deleteConversation);

// Update title
router.patch('/:id/title', validate(updateConversationTitleSchema), conversationController.updateTitle);

// Regenerate response
router.post('/:id/regenerate', conversationController.regenerateResponse);

// Edit message
router.post('/:id/edit', validate(editMessageSchema), conversationController.editMessage);

// Delete message
router.delete('/:id/messages/:messageId', conversationController.deleteMessage);

// Get message generations
router.get('/:id/messages/:messageId/generations', conversationController.getMessageGenerations);

// Restore message (undo)
router.post('/messages/:messageId/restore', conversationController.restoreMessage);

// Cancel stream (stop generation)
router.post('/:id/cancel-stream', conversationController.cancelStream);

// Send message (Text Chat)
router.post('/:id/messages', conversationController.sendMessage);

// Get prompt templates
router.get('/prompt-templates', conversationController.getPromptTemplates);

// Update system prompt
router.patch('/:id/system-prompt', validate(updateSystemPromptSchema), conversationController.updateSystemPrompt);

// Update template
router.patch('/:id/template', conversationController.updateTemplate);

// Update model
router.patch('/:id/model', conversationController.updateModel);

// Export conversation
router.get('/:sessionId/export/markdown', conversationController.exportMarkdown);
router.get('/:sessionId/export/json', conversationController.exportJson);

export default router;
