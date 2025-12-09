import { CircuitBreaker } from '../../../src/core/reliability/circuit-breaker';

describe('CircuitBreaker', () => {
    let breaker: CircuitBreaker;

    beforeEach(() => {
        breaker = new CircuitBreaker('test-service', {
            failureThreshold: 3,
            resetTimeoutMs: 1000,
            requestTimeoutMs: 5000,
        });
    });

    describe('execute', () => {
        it('should execute function when circuit is closed', async () => {
            const mockFn = jest.fn().mockResolvedValue('success');

            const result = await breaker.execute(mockFn);

            expect(result).toBe('success');
            expect(mockFn).toHaveBeenCalledTimes(1);
        });

        it('should pass through function arguments', async () => {
            const mockFn = jest.fn().mockResolvedValue('result');

            await breaker.execute(() => mockFn('arg1', 'arg2'));

            expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
        });

        it('should open circuit after threshold failures', async () => {
            const mockFn = jest.fn().mockRejectedValue(new Error('Service unavailable'));

            // Trigger failures to reach threshold
            for (let i = 0; i < 3; i++) {
                await expect(breaker.execute(mockFn)).rejects.toThrow('Service unavailable');
            }

            // Next call should fail immediately with circuit open error
            await expect(breaker.execute(mockFn)).rejects.toThrow('Circuit breaker open');

            // Function should not be called when circuit is open
            expect(mockFn).toHaveBeenCalledTimes(3);
        });

        it('should count only failures, not successes', async () => {
            const mockFn = jest.fn()
                .mockRejectedValueOnce(new Error('fail'))
                .mockResolvedValueOnce('success')
                .mockRejectedValueOnce(new Error('fail'))
                .mockRejectedValueOnce(new Error('fail'))
                .mockRejectedValueOnce(new Error('fail'));

            // First failure
            await expect(breaker.execute(mockFn)).rejects.toThrow();

            // Success (resets failure count)
            await expect(breaker.execute(mockFn)).resolves.toBe('success');

            // Need 3 more failures to open
            await expect(breaker.execute(mockFn)).rejects.toThrow();
            await expect(breaker.execute(mockFn)).rejects.toThrow();
            await expect(breaker.execute(mockFn)).rejects.toThrow();

            // Circuit should now be open
            await expect(breaker.execute(mockFn)).rejects.toThrow('Circuit breaker open');
        });

        it('should reset to half-open after timeout', async () => {
            const mockFn = jest.fn()
                .mockRejectedValueOnce(new Error('fail'))
                .mockRejectedValueOnce(new Error('fail'))
                .mockRejectedValueOnce(new Error('fail'))
                .mockResolvedValueOnce('success');

            // Open the circuit
            for (let i = 0; i < 3; i++) {
                await expect(breaker.execute(mockFn)).rejects.toThrow();
            }

            // Verify circuit is open
            await expect(breaker.execute(mockFn)).rejects.toThrow('Circuit breaker open');

            // Wait for reset timeout
            await new Promise(resolve => setTimeout(resolve, 1100));

            // Should allow one request through (half-open state)
            const result = await breaker.execute(mockFn);
            expect(result).toBe('success');
        });

        it('should close circuit after successful request in half-open state', async () => {
            const mockFn = jest.fn()
                .mockRejectedValue(new Error('fail'))
                .mockResolvedValue('success');

            // Open circuit
            for (let i = 0; i < 3; i++) {
                await expect(breaker.execute(mockFn)).rejects.toThrow();
            }

            // Wait for reset
            await new Promise(resolve => setTimeout(resolve, 1100));

            // Successful request should close circuit
            mockFn.mockResolvedValue('success');
            await expect(breaker.execute(mockFn)).resolves.toBe('success');

            // Subsequent requests should work
            await expect(breaker.execute(mockFn)).resolves.toBe('success');
        });

        it('should reopen circuit if request fails in half-open state', async () => {
            const mockFn = jest.fn().mockRejectedValue(new Error('fail'));

            // Open circuit
            for (let i = 0; i < 3; i++) {
                await expect(breaker.execute(mockFn)).rejects.toThrow();
            }

            // Wait for reset
            await new Promise(resolve => setTimeout(resolve, 1100));

            // Failed request in half-open should reopen circuit
            await expect(breaker.execute(mockFn)).rejects.toThrow('fail');

            // Circuit should be open again
            await expect(breaker.execute(mockFn)).rejects.toThrow('Circuit breaker open');
        });

        it('should handle timeout errors', async () => {
            const slowFn = jest.fn().mockImplementation(() =>
                new Promise(resolve => setTimeout(() => resolve('slow'), 10000))
            );

            const fastBreaker = new CircuitBreaker('fast', {
                failureThreshold: 1,
                resetTimeoutMs: 1000,
                requestTimeoutMs: 100,
            });

            await expect(fastBreaker.execute(slowFn)).rejects.toThrow();
        });

        it('should track metrics', async () => {
            const mockFn = jest.fn()
                .mockResolvedValueOnce('success')
                .mockRejectedValueOnce(new Error('fail'));

            await breaker.execute(mockFn);
            await expect(breaker.execute(mockFn)).rejects.toThrow();

            const stats = breaker.getStats();

            expect(stats.totalRequests).toBe(2);
            expect(stats.successCount).toBe(1);
            expect(stats.failureCount).toBe(1);
        });
    });

    describe('getStats', () => {
        it('should return circuit breaker statistics', async () => {
            const mockFn = jest.fn().mockResolvedValue('success');

            await breaker.execute(mockFn);
            await breaker.execute(mockFn);

            const stats = breaker.getStats();

            expect(stats).toHaveProperty('state');
            expect(stats).toHaveProperty('totalRequests');
            expect(stats).toHaveProperty('successCount');
            expect(stats).toHaveProperty('failureCount');
            expect(stats.totalRequests).toBe(2);
        });
    });

    describe('reset', () => {
        it('should reset circuit breaker state', async () => {
            const mockFn = jest.fn().mockRejectedValue(new Error('fail'));

            // Open circuit
            for (let i = 0; i < 3; i++) {
                await expect(breaker.execute(mockFn)).rejects.toThrow();
            }

            // Reset
            breaker.reset();

            // Should be able to execute again
            mockFn.mockResolvedValue('success');
            await expect(breaker.execute(mockFn)).resolves.toBe('success');
        });
    });
});
