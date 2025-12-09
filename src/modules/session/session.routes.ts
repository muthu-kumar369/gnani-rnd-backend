// src/modules/session/session.routes.ts
import { Router } from 'express';
import sessionPersistence from './session.persistence.js';
import { createContextualLogger } from '../../core/logger/logger.js';

const router = Router();
const logger = createContextualLogger({ module: 'SessionRoutes' });

/**
 * Export session state for migration
 * GET /api/session/:sessionId/export
 */
router.get('/:sessionId/export', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const session = await sessionPersistence.loadSession(sessionId);

        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }

        // Return session data for migration
        res.json({
            success: true,
            data: {
                sessionId: session.sessionId,
                userId: session.userId,
                conversationId: session.conversationId,
                state: session.state,
                audioBuffer: session.audioBuffer,
                pendingTranscript: session.pendingTranscript,
                contextSnapshot: session.contextSnapshot,
                llmState: session.llmState,
                createdAt: session.createdAt,
                lastActivity: session.lastActivity,
                metadata: session.metadata
            }
        });

        logger.info(`Session exported: ${sessionId}`);
    } catch (error: any) {
        logger.error(`Failed to export session: ${error.message}`);
        res.status(500).json({
            success: false,
            error: 'Failed to export session'
        });
    }
});

/**
 * Import session state from another instance
 * POST /api/session/import
 */
router.post('/import', async (req, res) => {
    try {
        const sessionData = req.body;

        if (!sessionData.sessionId || !sessionData.userId) {
            return res.status(400).json({
                success: false,
                error: 'Invalid session data'
            });
        }

        // Save imported session to MongoDB
        await sessionPersistence.saveSession({
            sessionId: sessionData.sessionId,
            userId: sessionData.userId,
            conversationId: sessionData.conversationId,
            state: sessionData.state || 'IDLE',
            audioBuffer: sessionData.audioBuffer || null,
            pendingTranscript: sessionData.pendingTranscript || null,
            contextSnapshot: sessionData.contextSnapshot || null,
            llmState: sessionData.llmState || null,
            createdAt: new Date(sessionData.createdAt),
            lastActivity: new Date(sessionData.lastActivity),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            metadata: sessionData.metadata || { grpcCallActive: false, deviceInfo: null }
        });

        res.json({
            success: true,
            message: 'Session imported successfully',
            sessionId: sessionData.sessionId
        });

        logger.info(`Session imported: ${sessionData.sessionId}`);
    } catch (error: any) {
        logger.error(`Failed to import session: ${error.message}`);
        res.status(500).json({
            success: false,
            error: 'Failed to import session'
        });
    }
});

/**
 * Get all active sessions for a user
 * GET /api/session/user/:userId
 */
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const sessions = await sessionPersistence.getUserSessions(userId);

        res.json({
            success: true,
            count: sessions.length,
            sessions: sessions.map(s => ({
                sessionId: s.sessionId,
                conversationId: s.conversationId,
                state: s.state,
                lastActivity: s.lastActivity,
                expiresAt: s.expiresAt
            }))
        });
    } catch (error: any) {
        logger.error(`Failed to get user sessions: ${error.message}`);
        res.status(500).json({
            success: false,
            error: 'Failed to get user sessions'
        });
    }
});


/**
 * Replay a session
 * POST /api/session/:sessionId/replay
 * Body: { speed?: number }
 */
import sessionReplayService from './session-replay.service.js';

router.post('/:sessionId/replay', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { speed } = req.body;

        // Trigger async replay
        // Note: This effectively starts "playing" events. 
        // In a real app, this might push events to a websocket or SSE channel.
        // For this implementation, strictly following the service method which logs and emits events.
        sessionReplayService.replaySession(sessionId, speed || 1.0, (event) => {
            // Optional: could stream this back if response handling allowed, but this is a fire-and-forget trigger mostly
            logger.debug(`Replaying event: ${event.type}`);
        });

        res.json({
            success: true,
            message: 'Session replay started'
        });
    } catch (error: any) {
        logger.error(`Failed to start replay: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to start replay' });
    }
});

/**
 * Get session events for debugging
 * GET /api/session/:sessionId/events
 */
router.get('/:sessionId/events', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const events = await sessionReplayService.getEvents(sessionId);
        
        res.json({
            success: true,
            count: events.length,
            events
        });
    } catch (error: any) {
        logger.error(`Failed to get session events: ${error.message}`);
        res.status(500).json({ success: false, error: 'Failed to get session events' });
    }
});

export default router;
