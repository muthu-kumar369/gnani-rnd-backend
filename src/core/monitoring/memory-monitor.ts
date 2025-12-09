import { createContextualLogger } from '../logger/logger.js';

export class MemoryMonitor {
    private readonly logger = createContextualLogger({ module: 'MemoryMonitor' });
    private readonly thresholdMB = 1024; // 1GB threshold
    private interval: NodeJS.Timeout | null = null;
    private history: Array<{
        timestamp: number;
        heapUsed: number;
        heapTotal: number;
        rss: number;
    }> = [];
    private readonly maxHistoryLength = 100;

    start(): void {
        this.logger.info('Starting memory monitor');
        this.interval = setInterval(() => {
            this.checkMemory();
        }, 30000); // Check every 30 seconds
    }

    stop(): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            this.logger.info('Memory monitor stopped');
        }
    }

    private checkMemory(): void {
        const usage = process.memoryUsage();
        const heapUsedMB = usage.heapUsed / 1024 / 1024;
        const heapTotalMB = usage.heapTotal / 1024 / 1024;
        const rssUsedMB = usage.rss / 1024 / 1024;

        // Store in history
        this.history.push({
            timestamp: Date.now(),
            heapUsed: heapUsedMB,
            heapTotal: heapTotalMB,
            rss: rssUsedMB,
        });

        if (this.history.length > this.maxHistoryLength) {
            this.history.shift();
        }

        // Check for high memory usage
        if (heapUsedMB > this.thresholdMB) {
            this.logger.warn('High memory usage detected', {
                heapUsedMB: heapUsedMB.toFixed(2),
                heapTotalMB: heapTotalMB.toFixed(2),
                rssUsedMB: rssUsedMB.toFixed(2),
                externalMB: (usage.external / 1024 / 1024).toFixed(2),
            });

            // Trigger garbage collection if available
            if (global.gc) {
                global.gc();
                this.logger.info('Manual garbage collection triggered');
            }
        }

        // Check for memory leak (increasing trend)
        if (this.detectMemoryLeak()) {
            this.logger.error('Potential memory leak detected!', {
                trend: this.calculateTrend(),
            });
        }
    }

    /**
     * Detect potential memory leak by analyzing trend
     */
    private detectMemoryLeak(): boolean {
        if (this.history.length < 10) {
            return false;
        }

        const trend = this.calculateTrend();

        // If memory is consistently increasing over last 10 samples
        return trend > 5; // 5MB/sample threshold
    }

    /**
     * Calculate memory usage trend (MB per sample)
     */
    private calculateTrend(): number {
        if (this.history.length < 2) {
            return 0;
        }

        const recent = this.history.slice(-10);
        const first = recent[0];
        const last = recent[recent.length - 1];

        return (last.heapUsed - first.heapUsed) / recent.length;
    }

    /**
     * Get current memory usage
     */
    getMemoryUsage(): {
        heapUsed: number;
        heapTotal: number;
        rss: number;
        external: number;
    } {
        const usage = process.memoryUsage();
        return {
            heapUsed: usage.heapUsed / 1024 / 1024,
            heapTotal: usage.heapTotal / 1024 / 1024,
            rss: usage.rss / 1024 / 1024,
            external: usage.external / 1024 / 1024,
        };
    }

    /**
     * Get memory usage history
     */
    getHistory() {
        return this.history;
    }

    /**
     * Get memory statistics
     */
    getStats() {
        if (this.history.length === 0) {
            return null;
        }

        const heapUsed = this.history.map(h => h.heapUsed);
        const avg = heapUsed.reduce((a, b) => a + b, 0) / heapUsed.length;
        const max = Math.max(...heapUsed);
        const min = Math.min(...heapUsed);

        return {
            average: avg.toFixed(2),
            max: max.toFixed(2),
            min: min.toFixed(2),
            current: heapUsed[heapUsed.length - 1].toFixed(2),
            trend: this.calculateTrend().toFixed(2),
            samples: this.history.length,
        };
    }

    /**
     * Force garbage collection (if available)
     */
    forceGC(): boolean {
        if (global.gc) {
            global.gc();
            this.logger.info('Forced garbage collection');
            return true;
        }
        this.logger.warn('Garbage collection not available (run with --expose-gc)');
        return false;
    }
}
