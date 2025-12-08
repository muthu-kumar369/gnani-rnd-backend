import { createContextualLogger } from '../logger/logger.js';
import { Logger } from 'winston';
import metrics from '../monitoring/metrics.js';

export enum CircuitState {
    CLOSED = 'CLOSED',     // Normal operation
    OPEN = 'OPEN',         // Failing, blocking requests
    HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

export interface CircuitBreakerConfig {
    failureThreshold: number;      // Number of failures before opening
    resetTimeoutMs: number;        // Time to wait before trying again (Half-Open)
    requestTimeoutMs?: number;     // Timeout for individual requests
    halfOpenRequests?: number;     // Number of successful requests needed in half-open
    monitoringEnabled?: boolean;   // Enable Prometheus metrics
}

export class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount: number = 0;
    private successCount: number = 0; // For half-open state
    private lastFailureTime: number = 0;
    private config: CircuitBreakerConfig;
    private logger: Logger;
    private name: string;

    constructor(name: string, config: CircuitBreakerConfig) {
        this.name = name;
        this.config = {
            ...config,
            halfOpenRequests: config.halfOpenRequests || 3,
            monitoringEnabled: config.monitoringEnabled !== false
        };
        this.logger = createContextualLogger({ module: `CircuitBreaker:${name}` });
        this.updateMetrics();
    }

    /**
     * Execute a function through the circuit breaker
     */
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === CircuitState.OPEN) {
            if (Date.now() - this.lastFailureTime > this.config.resetTimeoutMs) {
                this.transitionTo(CircuitState.HALF_OPEN);
            } else {
                this.logger.warn(`Circuit is OPEN. Request blocked.`);
                throw new Error(`CircuitBreaker '${this.name}' is OPEN`);
            }
        }

        try {
            const result = await this.executeWithTimeout(fn);
            this.onSuccess();
            return result;
        } catch (error: any) {
            this.onFailure(error);
            throw error;
        }
    }

    /**
     * Execute with timeout wrapper
     */
    private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
        if (!this.config.requestTimeoutMs) {
            return fn();
        }

        let timeoutId: NodeJS.Timeout;
        const timeoutPromise = new Promise<T>((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error(`Request timed out after ${this.config.requestTimeoutMs}ms`));
            }, this.config.requestTimeoutMs);
        });

        try {
            const result = await Promise.race([fn(), timeoutPromise]);
            clearTimeout(timeoutId!);
            return result;
        } catch (error) {
            clearTimeout(timeoutId!);
            throw error;
        }
    }

    private onSuccess() {
        if (this.state === CircuitState.HALF_OPEN) {
            this.successCount++;
            this.logger.debug(`Half-open success count: ${this.successCount}/${this.config.halfOpenRequests}`);

            if (this.successCount >= (this.config.halfOpenRequests || 3)) {
                this.transitionTo(CircuitState.CLOSED);
                this.successCount = 0;
            }
        } else if (this.state === CircuitState.CLOSED) {
            this.failureCount = 0; // Reset on success
        }

        this.updateMetrics();
    }

    private onFailure(error: Error) {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        this.logger.error(`Request failed (Count: ${this.failureCount}/${this.config.failureThreshold}): ${error.message}`);

        if (this.state === CircuitState.HALF_OPEN) {
            this.logger.warn(`Half-open test failed, circuit transitioning to OPEN: ${this.name}`);
            this.transitionTo(CircuitState.OPEN);
            this.successCount = 0;
        } else if (this.failureCount >= this.config.failureThreshold) {
            this.transitionTo(CircuitState.OPEN);
        }

        this.updateMetrics();
    }

    private transitionTo(newState: CircuitState) {
        this.logger.info(`Transitioning from ${this.state} to ${newState}`);
        this.state = newState;
        if (newState === CircuitState.CLOSED) {
            this.failureCount = 0;
        }
        this.updateMetrics();
    }

    private updateMetrics(): void {
        if (!this.config.monitoringEnabled) return;

        // Update circuit breaker state metric
        const stateValue = this.state === CircuitState.CLOSED ? 0 :
            this.state === CircuitState.HALF_OPEN ? 1 : 2;

        metrics.circuitBreakerState.set(
            { circuit: this.name, state: this.state },
            stateValue
        );

        metrics.circuitBreakerFailures.set(
            { circuit: this.name },
            this.failureCount
        );
    }

    getState(): CircuitState {
        return this.state;
    }

    getStats() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            lastFailureTime: this.lastFailureTime
        };
    }

    // Manual control (for testing/admin)
    forceOpen(): void {
        this.state = CircuitState.OPEN;
        this.logger.warn(`Circuit manually forced OPEN: ${this.name}`);
        this.updateMetrics();
    }

    forceClose(): void {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.logger.info(`Circuit manually forced CLOSED: ${this.name}`);
        this.updateMetrics();
    }
}
