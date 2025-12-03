import express from 'express';
import sessionManager from '../modules/session/session.manager.js';
import { createContextualLogger } from '../core/logger/logger.js';

const router = express.Router();
const logger = createContextualLogger({ module: 'ChatRoutes' });

// HTTP Chat Endpoint for Mobile/Web clients (non-gRPC)
router.post('/', async (req, res) => {
    const { message, sessionId, userId } = req.body;

    if (!message || !userId) {
        return res.status(400).json({ error: 'Message and userId are required' });
    }

    const currentSessionId = sessionId || await sessionManager.startSession(
        userId,
        () => { }, // No-op for transcription callback
        () => { }, // No-op for LLM chunk (we'll return full response)
        () => { }  // No-op for tool status
    );

    try {
        logger.info(`Processing HTTP chat request for session ${currentSessionId}`);

        // Process text input
        const response = await sessionManager.processTextInput(currentSessionId, message);

        if (!response) {
            return res.status(500).json({ error: 'Failed to process message' });
        }

        res.json({
            sessionId: currentSessionId,
            text: response.llmResponse,
            intent: response.intent,
            action: response.actionDirective
        });

    } catch (error: any) {
        logger.error(`Error processing chat request: ${error.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
