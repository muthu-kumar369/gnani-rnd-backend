// src/modules/memory/performance-tracker.ts
import { createContextualLogger } from '../../core/logger/logger.js';
import { Logger } from 'winston';
import { PerformanceMetrics } from './self-adjuster.js';

interface RetrievalEvent {
    timestamp: Date;
    query: string;
    retrievedCount: number;
    relevanceScore: number;
    averageAge: number;
    cacheHit: boolean;
    retrievalTime: number; // ms
}

interface AggregatedMetrics extends PerformanceMetrics {
    totalRetrievals: number;
    cacheHitRate: number;
    averageRetrievalTime: number;
}

class PerformanceTracker {
    private logger: Logger;
    private events: RetrievalEvent[];
    private maxEvents: number;

    constructor() {
        this.logger = createContextualLogger({ module: 'PerformanceTracker' });
        this.events = [];
        this.maxEvents = 1000; // Keep last 1000 events
        this.logger.info('PerformanceTracker initialized');
    }

    /**
     * Track a memory retrieval event
     */
    trackRetrieval(event: RetrievalEvent): void {
        this.events.push(event);

        // Keep only recent events
        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(-this.maxEvents);
        }

        this.logger.debug(
            `Tracked retrieval: ${event.retrievedCount} memories, ` +
            `relevance=${event.relevanceScore.toFixed(2)}, ` +
            `time=${event.retrievalTime}ms`
        );
    }

    /**
     * Get aggregated performance metrics
     */
    getMetrics(windowMinutes: number = 60): AggregatedMetrics {
        const cutoffTime = new Date(Date.now() - windowMinutes * 60 * 1000);
        const recentEvents = this.events.filter(e => e.timestamp >= cutoffTime);

        if (recentEvents.length === 0) {
            return {
                relevanceScore: 0.5,
                hitRate: 0,
                averageAge: 0,
                totalRetrievals: 0,
                cacheHitRate: 0,
                averageRetrievalTime: 0
            };
        }

        const totalRetrievals = recentEvents.length;
        const relevanceScore = recentEvents.reduce((sum, e) => sum + e.relevanceScore, 0) / totalRetrievals;
        const hitRate = recentEvents.filter(e => e.retrievedCount > 0).length / totalRetrievals;
        const averageAge = recentEvents.reduce((sum, e) => sum + e.averageAge, 0) / totalRetrievals;
        const cacheHitRate = recentEvents.filter(e => e.cacheHit).length / totalRetrievals;
        const averageRetrievalTime = recentEvents.reduce((sum, e) => sum + e.retrievalTime, 0) / totalRetrievals;

        return {
            relevanceScore,
            hitRate,
            averageAge,
            totalRetrievals,
            cacheHitRate,
            averageRetrievalTime
        };
    }

    /**
     * Get recent events for analysis
     */
    getRecentEvents(limit: number = 10): RetrievalEvent[] {
        return this.events.slice(-limit);
    }

    /**
     * Clear all tracked events
     */
    clear(): void {
        this.events = [];
        this.logger.info('Performance tracker cleared');
    }

    /**
     * Get statistics for monitoring
     */
    getStats(): any {
        const metrics = this.getMetrics(60); // Last hour

        return {
            totalEventsTracked: this.events.length,
            last60MinMetrics: metrics,
            last24HourMetrics: this.getMetrics(1440)
        };
    }
}

export default new PerformanceTracker();
