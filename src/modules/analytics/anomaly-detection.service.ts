import logger from '../../core/logger/logger.js';

interface Anomaly {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    value: number;
    threshold: number;
    timestamp: number;
}

/**
 * Anomaly Detection Service
 * Stage 5 Task 5.10: Statistical anomaly detection
 */
export class AnomalyDetectionService {
    private readonly zScoreThreshold = 3; // 3 standard deviations

    async detectAnomalies(userId: string): Promise<Anomaly[]> {
        try {
            logger.debug('Detecting anomalies', {
                context: 'AnomalyDetectionService',
                userId
            });

            // Get recent metrics
            const metrics = await this.getMetrics(userId, 30); // Last 30 days

            const anomalies: Anomaly[] = [];

            // Check request rate
            if (this.isAnomalous(metrics.requestRate, metrics.historicalRequestRate)) {
                anomalies.push({
                    type: 'request_rate',
                    severity: 'high',
                    message: 'Unusual request rate detected',
                    value: metrics.requestRate,
                    threshold: this.calculateThreshold(metrics.historicalRequestRate),
                    timestamp: Date.now()
                });
            }

            // Check error rate
            if (this.isAnomalous(metrics.errorRate, metrics.historicalErrorRate)) {
                anomalies.push({
                    type: 'error_rate',
                    severity: 'critical',
                    message: 'Error rate spike detected',
                    value: metrics.errorRate,
                    threshold: this.calculateThreshold(metrics.historicalErrorRate),
                    timestamp: Date.now()
                });
            }

            // Check token usage
            if (this.isAnomalous(metrics.tokenUsage, metrics.historicalTokenUsage)) {
                anomalies.push({
                    type: 'token_usage',
                    severity: 'medium',
                    message: 'Unusual token usage pattern',
                    value: metrics.tokenUsage,
                    threshold: this.calculateThreshold(metrics.historicalTokenUsage),
                    timestamp: Date.now()
                });
            }

            // Check response time
            if (this.isAnomalous(metrics.responseTime, metrics.historicalResponseTime)) {
                anomalies.push({
                    type: 'response_time',
                    severity: 'high',
                    message: 'Response time degradation detected',
                    value: metrics.responseTime,
                    threshold: this.calculateThreshold(metrics.historicalResponseTime),
                    timestamp: Date.now()
                });
            }

            if (anomalies.length > 0) {
                logger.warn('Anomalies detected', {
                    context: 'AnomalyDetectionService',
                    userId,
                    count: anomalies.length,
                    types: anomalies.map(a => a.type)
                });
            }

            return anomalies;
        } catch (error) {
            logger.error('Anomaly detection failed', error);
            return [];
        }
    }

    isAnomalous(current: number, historical: number[]): boolean {
        if (historical.length < 2) return false;

        const mean = historical.reduce((a, b) => a + b, 0) / historical.length;
        const variance = historical.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historical.length;
        const stdDev = Math.sqrt(variance);

        if (stdDev === 0) return false;

        // Z-score > threshold is anomalous
        const zScore = Math.abs((current - mean) / stdDev);
        return zScore > this.zScoreThreshold;
    }

    private calculateThreshold(historical: number[]): number {
        const mean = historical.reduce((a, b) => a + b, 0) / historical.length;
        const variance = historical.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historical.length;
        const stdDev = Math.sqrt(variance);
        return mean + (this.zScoreThreshold * stdDev);
    }

    private async getMetrics(userId: string, days: number): Promise<any> {
        // TODO: Fetch from analytics database
        // For now, return mock data
        return {
            requestRate: 100,
            historicalRequestRate: [95, 98, 102, 97, 99, 101, 96, 100],
            errorRate: 0.02,
            historicalErrorRate: [0.01, 0.015, 0.012, 0.018, 0.014, 0.016, 0.013, 0.015],
            tokenUsage: 5000,
            historicalTokenUsage: [4800, 4900, 5100, 4950, 5050, 4850, 5000, 4900],
            responseTime: 250,
            historicalResponseTime: [200, 210, 205, 215, 208, 212, 206, 210]
        };
    }

    async sendAlert(anomaly: Anomaly, userId: string): Promise<void> {
        logger.warn('Anomaly alert', {
            context: 'AnomalyDetectionService',
            userId,
            anomaly
        });

        // TODO: Send notification (email, webhook, etc.)
    }
}

export const anomalyDetectionService = new AnomalyDetectionService();
