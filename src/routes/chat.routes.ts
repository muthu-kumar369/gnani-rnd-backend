import express from 'express';
import sessionCoordinator from '../modules/session/session.coordinator.js';
import { createContextualLogger } from '../core/logger/logger.js';
import { authMiddleware, type CustomRequest } from '../core/security/auth.middleware.js';
import { validate } from '../middleware/zod.middleware.js';
import { z } from 'zod';
import { trackTokenUsage, trackEvent } from '../middleware/analytics.middleware.js'; // STAGE 20

const router = express.Router();
const logger = createContextualLogger({ module: 'ChatRoutes' });

// Zod schema for chat request
const chatRequestSchema = z.object({
    body: z.object({
        message: z.string().min(1, 'Message cannot be empty').max(10000, 'Message too long'),
        conversationId: z.string().uuid().optional(),
        sessionId: z.string().uuid().optional(),
    })
});

// HTTP Chat Endpoint for Mobile/Web clients (non-gRPC)
router.post('/', authMiddleware, validate(chatRequestSchema), async (req: CustomRequest, res) => {
    const { message, conversationId, sessionId } = req.body; // Accept conversationId
    const userId = req.user?.id; // Extract userId from authenticated request

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    // Start session with conversationId
    // We pass undefined for existingSessionId to let it generate a new ephemeral session
    // unless the client specifically provided one.
    const sessionResult = await sessionCoordinator.startSession(
        userId,
        async () => { }, // No-op for transcription callback
        async () => { }, // No-op for LLM chunk (we'll return full response)
        async () => { }, // No-op for LLM complete
        async () => { }, // No-op for tool status
        sessionId, // Optional existing ephemeral session
        conversationId // Pass conversationId
    );

    const currentSessionId = sessionResult.sessionId;
    const currentConversationId = sessionResult.conversationId;

    try {
        logger.info(`Processing HTTP chat request for conversation ${currentConversationId} (session ${currentSessionId})`);

        // STAGE 20: Track message sent event
        const startTime = Date.now();
        await trackEvent(userId, 'message_sent', { conversationId: currentConversationId }, currentConversationId);

        // Process text input via Coordinator
        const response = await sessionCoordinator.processTextInput(currentSessionId, message);

        if (!response) {
            return res.status(500).json({ error: 'Failed to process message' });
        }

        // STAGE 20: Track token usage (estimate if not available)
        const duration = Date.now() - startTime;
        const estimatedTokens = Math.ceil((message.length + (response.llmResponse?.length || 0)) / 4); // Rough estimate
        await trackTokenUsage(userId, currentConversationId, estimatedTokens, 'gpt-3.5-turbo', duration);

        res.json({
            conversationId: currentConversationId, // Return conversationId
            sessionId: currentSessionId,
            message: response.llmResponse, // Changed from 'text' to 'message' to match frontend
            // intent and action are not currently returned by Coordinator's simplified interface
            // but the core requirement is the text response.
            intent: 'general_query',
            action: null
        });

    } catch (error: any) {
        logger.error(`Error processing chat request: ${error.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
