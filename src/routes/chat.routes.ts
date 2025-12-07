import express from 'express';
import sessionCoordinator from '../modules/session/session.coordinator.js';
import { createContextualLogger } from '../core/logger/logger.js';
import { authMiddleware, type CustomRequest } from '../core/security/auth.middleware.js';

const router = express.Router();
const logger = createContextualLogger({ module: 'ChatRoutes' });

// HTTP Chat Endpoint for Mobile/Web clients (non-gRPC)
router.post('/', authMiddleware, async (req: CustomRequest, res) => {
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

        // Process text input via Coordinator
        const response = await sessionCoordinator.processTextInput(currentSessionId, message);

        if (!response) {
            return res.status(500).json({ error: 'Failed to process message' });
        }

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
