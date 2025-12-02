// src/core/monitoring/latency.monitor.ts
import { createContextualLogger } from '../logger/logger.js';
import { Logger } from 'winston';

interface TimingData {
    start: number;
    end?: number;
    duration?: number;
}

interface LatencyReport {
    type: 'latency_report';
    sessionId: string;
    timestamp: string;
    metrics: {
        vad_latency_ms?: number;
        stt_latency_ms?: number;
        llm_ttft_ms?: number;
        llm_total_ms?: number;
        total_e2e_ms?: number;
    };
    breakdown: Record<string, TimingData>;
}

class LatencyMonitor {
    private logger: Logger;
    private timings: Map<string, Map<string, TimingData>>;

    constructor() {
        this.logger = createContextualLogger({ module: 'LatencyMonitor' });
        this.timings = new Map();
    }

    /**
     * Start a timer for a specific stage
     */
    startTimer(id: string, stage: string): void {
        if (!this.timings.has(id)) {
            this.timings.set(id, new Map());
        }

        const sessionTimings = this.timings.get(id)!;
        sessionTimings.set(stage, {
            start: Date.now()
        });

        this.logger.debug(`Timer started: ${stage} for ${id}`);
    }

    /**
     * End a timer for a specific stage and return duration
     */
    endTimer(id: string, stage: string): number {
        const sessionTimings = this.timings.get(id);
        if (!sessionTimings) {
            this.logger.warn(`No timings found for ${id}`);
            return 0;
        }

        const timing = sessionTimings.get(stage);
        if (!timing || !timing.start) {
            this.logger.warn(`No start time found for ${stage} in ${id}`);
            return 0;
        }

        const end = Date.now();
        const duration = end - timing.start;

        timing.end = end;
        timing.duration = duration;

        this.logger.debug(`Timer ended: ${stage} for ${id} - ${duration}ms`);
        return duration;
    }

    /**
     * Get latency report for a session
     */
    getReport(id: string): LatencyReport | null {
        const sessionTimings = this.timings.get(id);
        if (!sessionTimings) {
            return null;
        }

        const breakdown: Record<string, TimingData> = {};
        sessionTimings.forEach((timing, stage) => {
            breakdown[stage] = { ...timing };
        });

        // Calculate metrics
        const metrics: LatencyReport['metrics'] = {};
        
        if (breakdown.vad?.duration) {
            metrics.vad_latency_ms = breakdown.vad.duration;
        }
        if (breakdown.stt?.duration) {
            metrics.stt_latency_ms = breakdown.stt.duration;
        }
        if (breakdown.llm_ttft?.duration) {
            metrics.llm_ttft_ms = breakdown.llm_ttft.duration;
        }
        if (breakdown.llm_total?.duration) {
            metrics.llm_total_ms = breakdown.llm_total.duration;
        }

        // Calculate total E2E if we have all stages
        const stages = ['vad', 'stt', 'llm_total'];
        const allStagesPresent = stages.every(s => breakdown[s]?.duration);
        if (allStagesPresent) {
            metrics.total_e2e_ms = stages.reduce((sum, s) => sum + (breakdown[s]?.duration || 0), 0);
        }

        return {
            type: 'latency_report',
            sessionId: id,
            timestamp: new Date().toISOString(),
            metrics,
            breakdown
        };
    }

    /**
     * Log latency report and clear session data
     */
    logReport(id: string): void {
        const report = this.getReport(id);
        if (!report) {
            this.logger.warn(`No report available for ${id}`);
            return;
        }

        // Log as structured JSON
        this.logger.info('Latency Report', {
            ...report,
            context: 'LatencyMonitor'
        });

        // Also log a condensed version for easy reading
        const { metrics } = report;
        this.logger.info(
            `Latency Summary [${id}]: VAD=${metrics.vad_latency_ms || 'N/A'}ms, ` +
            `STT=${metrics.stt_latency_ms || 'N/A'}ms, ` +
            `LLM_TTFT=${metrics.llm_ttft_ms || 'N/A'}ms, ` +
            `LLM_Total=${metrics.llm_total_ms || 'N/A'}ms, ` +
            `E2E=${metrics.total_e2e_ms || 'N/A'}ms`
        );
    }

    /**
     * Clear timing data for a session
     */
    clearSession(id: string): void {
        this.timings.delete(id);
        this.logger.debug(`Cleared timing data for ${id}`);
    }

    /**
     * Get all active sessions being tracked
     */
    getActiveSessions(): string[] {
        return Array.from(this.timings.keys());
    }
}

export default new LatencyMonitor();
