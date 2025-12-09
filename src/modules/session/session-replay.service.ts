import { SessionEvent, ISessionEvent } from './session-event.model.js';
import logger from '../../core/logger/logger.js';
import { EventEmitter } from 'events';

export class SessionReplayService extends EventEmitter {

    /**
     * Record a session event
     */
    async recordEvent(
        sessionId: string,
        type: string,
        data: any,
        metadata?: any
    ): Promise<void> {
        try {
            await SessionEvent.create({
                sessionId,
                type,
                data,
                metadata,
                timestamp: new Date()
            });
            logger.debug(`Recorded event ${type} for session ${sessionId}`);
        } catch (error: any) {
            logger.error(`Failed to record event for session ${sessionId}: ${error.message}`);
        }
    }

    /**
     * Replay a session
     * @param sessionId Session ID to replay
     * @param speedMultiplier Speed multiplier (default 1.0)
     * @param callback Callback for each event
     */
    async replaySession(
        sessionId: string,
        speedMultiplier: number = 1.0,
        callback: (event: ISessionEvent) => void
    ): Promise<void> {
        logger.info(`Starting replay for session ${sessionId} at ${speedMultiplier}x speed`);

        const events = await SessionEvent.find({ sessionId }).sort({ timestamp: 1 });

        if (events.length === 0) {
            logger.warn(`No events found for session ${sessionId}`);
            return;
        }

        const startTimestamp = events[0].timestamp.getTime();
        let previousTimestamp = startTimestamp;

        for (const event of events) {
            const currentTimestamp = event.timestamp.getTime();
            const originalDelay = currentTimestamp - previousTimestamp;
            const delay = originalDelay / speedMultiplier;

            if (delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            // Emit event via callback
            callback(event);

            // Also emit via EventEmitter
            this.emit('replay-event', { sessionId, event });

            previousTimestamp = currentTimestamp;
        }

        logger.info(`Replay finished for session ${sessionId}`);
        this.emit('replay-completed', { sessionId });
    }

    /**
     * Get all events for a session
     */
    async getEvents(sessionId: string): Promise<ISessionEvent[]> {
        return SessionEvent.find({ sessionId }).sort({ timestamp: 1 });
    }
}

export default new SessionReplayService();
