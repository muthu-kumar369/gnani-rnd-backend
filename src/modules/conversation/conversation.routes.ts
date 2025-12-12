import express from 'express';
import conversationController from './conversation.controller.js';
import { authMiddleware } from '../../core/security/auth.middleware.js';
import { upload } from '../../config/multer.config.js'; // STAGE 1: For file uploads
import { validateFileUpload } from '../../middleware/file-validation.middleware.js'; // STAGE 1

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

// Generate title automatically
router.post('/:id/title/generate', conversationController.generateTitle);

// Toggle conversation pin
router.patch('/:id/pin', conversationController.togglePin);

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

// Get paginated messages
router.get('/:id/messages', conversationController.getMessages);

// STAGE 1: Add attachments to conversation
router.post('/:id/attachments',
    upload.array('files', 10), // Allow up to 10 files
    validateFileUpload('document'), // Validate file size and type
    conversationController.addAttachments
);

// Get prompt templates
router.get('/prompt-templates', conversationController.getPromptTemplates);

// Update system prompt
router.patch('/:id/system-prompt', validate(updateSystemPromptSchema), conversationController.updateSystemPrompt);

// Update template
router.patch('/:id/template', conversationController.updateTemplate);

// Update model
router.patch('/:id/model', conversationController.updateModel);

// Share conversation
router.post('/:id/share', conversationController.shareConversation);

// Export conversation
router.get('/:id/export/markdown', conversationController.exportMarkdown);
router.get('/:id/export/json', conversationController.exportJson);

// STAGE 2: Additional undo/restore endpoints
router.patch('/:id/messages/:messageId', conversationController.updateMessageContent);
router.post('/:id/messages/restore', conversationController.restoreDeletedMessage);
router.post('/:id/messages/restore-generation', conversationController.restoreGeneration);

export default router;
