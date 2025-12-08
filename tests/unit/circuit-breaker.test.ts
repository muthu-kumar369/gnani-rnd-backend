// tests/unit/circuit-breaker.test.ts
import { CircuitBreaker, CircuitState } from '../../src/core/reliability/circuit-breaker.js';

describe('CircuitBreaker', () => {
    it('should start in CLOSED state', () => {
        const breaker = new CircuitBreaker('test', {
            failureThreshold: 3,
            resetTimeoutMs: 1000,
            requestTimeoutMs: 500,
            monitoringEnabled: false
        });

        expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should open after threshold failures', async () => {
        const breaker = new CircuitBreaker('test', {
            failureThreshold: 3,
            resetTimeoutMs: 1000,
            requestTimeoutMs: 500,
            monitoringEnabled: false
        });

        const failingFn = async () => {
            throw new Error('Test failure');
        };

        // Trigger 3 failures
        for (let i = 0; i < 3; i++) {
            try {
                await breaker.execute(failingFn);
            } catch (e) {
                // Expected to fail
            }
        }

        expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should reject requests when OPEN', async () => {
        const breaker = new CircuitBreaker('test', {
            failureThreshold: 2,
            resetTimeoutMs: 1000,
            requestTimeoutMs: 500,
            monitoringEnabled: false
        });

        // Open the circuit
        for (let i = 0; i < 2; i++) {
            try {
                await breaker.execute(async () => { throw new Error('fail'); });
            } catch (e) { }
        }

        expect(breaker.getState()).toBe(CircuitState.OPEN);

        // Try to execute - should be rejected
        await expect(breaker.execute(async () => 'success')).rejects.toThrow('Circuit breaker is OPEN');
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
        const breaker = new CircuitBreaker('test', {
            failureThreshold: 2,
            resetTimeoutMs: 100, // Short timeout for testing
            requestTimeoutMs: 500,
            monitoringEnabled: false
        });

        // Open circuit
        for (let i = 0; i < 2; i++) {
            try {
                await breaker.execute(async () => { throw new Error('fail'); });
            } catch (e) { }
        }

        expect(breaker.getState()).toBe(CircuitState.OPEN);

        // Wait for reset timeout
        await new Promise(resolve => setTimeout(resolve, 150));

        // Next request should transition to HALF_OPEN
        try {
            await breaker.execute(async () => 'success');
        } catch (e) { }

        const state = breaker.getState();
        expect(state === CircuitState.HALF_OPEN || state === CircuitState.CLOSED).toBe(true);
    });

    it('should close after successful half-open requests', async () => {
        const breaker = new CircuitBreaker('test', {
            failureThreshold: 2,
            resetTimeoutMs: 100,
            requestTimeoutMs: 500,
            halfOpenRequests: 2, // Need 2 successes
            monitoringEnabled: false
        });

        // Open circuit
        for (let i = 0; i < 2; i++) {
            try {
                await breaker.execute(async () => { throw new Error('fail'); });
            } catch (e) { }
        }

        // Wait for reset
        await new Promise(resolve => setTimeout(resolve, 150));

        // Execute 2 successful requests
        await breaker.execute(async () => 'success1');
        await breaker.execute(async () => 'success2');

        expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should timeout long-running requests', async () => {
        const breaker = new CircuitBreaker('test', {
            failureThreshold: 3,
            resetTimeoutMs: 1000,
            requestTimeoutMs: 100, // Short timeout
            monitoringEnabled: false
        });

        const slowFn = async () => {
            await new Promise(resolve => setTimeout(resolve, 500));
            return 'done';
        };

        await expect(breaker.execute(slowFn)).rejects.toThrow('timeout');
    });

    it('should support manual control - forceOpen', () => {
        const breaker = new CircuitBreaker('test', {
            failureThreshold: 3,
            resetTimeoutMs: 1000,
            requestTimeoutMs: 500,
            monitoringEnabled: false
        });

        expect(breaker.getState()).toBe(CircuitState.CLOSED);

        breaker.forceOpen();

        expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should support manual control - forceClose', async () => {
        const breaker = new CircuitBreaker('test', {
            failureThreshold: 2,
            resetTimeoutMs: 1000,
            requestTimeoutMs: 500,
            monitoringEnabled: false
        });

        // Open circuit
        for (let i = 0; i < 2; i++) {
            try {
                await breaker.execute(async () => { throw new Error('fail'); });
            } catch (e) { }
        }

        expect(breaker.getState()).toBe(CircuitState.OPEN);

        breaker.forceClose();

        expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should return stats', async () => {
        const breaker = new CircuitBreaker('test', {
            failureThreshold: 3,
            resetTimeoutMs: 1000,
            requestTimeoutMs: 500,
            monitoringEnabled: false
        });

        // Trigger a failure
        try {
            await breaker.execute(async () => { throw new Error('fail'); });
        } catch (e) { }

        const stats = breaker.getStats();

        expect(stats).toHaveProperty('state');
        expect(stats).toHaveProperty('failureCount');
        expect(stats).toHaveProperty('successCount');
        expect(stats).toHaveProperty('lastFailureTime');
        expect(stats.failureCount).toBe(1);
    });
});
