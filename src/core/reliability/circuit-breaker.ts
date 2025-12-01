import { createContextualLogger } from '../logger/logger.js';
import { Logger } from 'winston';

export enum CircuitState {
    CLOSED = 'CLOSED',     // Normal operation
    OPEN = 'OPEN',         // Failing, blocking requests
    HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

export interface CircuitBreakerConfig {
    failureThreshold: number;      // Number of failures before opening
    resetTimeoutMs: number;        // Time to wait before trying again (Half-Open)
    requestTimeoutMs?: number;     // Timeout for individual requests
}

export class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount: number = 0;
    private lastFailureTime: number = 0;
    private config: CircuitBreakerConfig;
    private logger: Logger;
    private name: string;

    constructor(name: string, config: CircuitBreakerConfig) {
        this.name = name;
        this.config = config;
        this.logger = createContextualLogger({ module: `CircuitBreaker:${name}` });
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
            this.transitionTo(CircuitState.CLOSED);
        }
        this.failureCount = 0;
    }

    private onFailure(error: Error) {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        this.logger.error(`Request failed (Count: ${this.failureCount}/${this.config.failureThreshold}): ${error.message}`);

        if (this.state === CircuitState.HALF_OPEN || this.failureCount >= this.config.failureThreshold) {
            this.transitionTo(CircuitState.OPEN);
        }
    }

    private transitionTo(newState: CircuitState) {
        this.logger.info(`Transitioning from ${this.state} to ${newState}`);
        this.state = newState;
        if (newState === CircuitState.CLOSED) {
            this.failureCount = 0;
        }
    }

    getState(): CircuitState {
        return this.state;
    }
}
