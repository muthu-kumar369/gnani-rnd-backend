// tests/unit/error-handling.test.ts
import { retryWithBackoff, retryDatabaseOperation, retryNetworkOperation } from '../../src/utils/retry.js';
import { NetworkError, ValidationError, DatabaseError, AppError } from '../../src/shared/errors/error-types.js';
import degradationService from '../../src/core/reliability/degradation.service.js';

describe('Error Handling', () => {
    describe('Retry Logic', () => {
        it('should retry on retryable errors', async () => {
            let attempts = 0;
            const fn = async () => {
                attempts++;
                if (attempts < 3) {
                    throw new NetworkError('Connection failed');
                }
                return 'success';
            };

            const result = await retryWithBackoff(fn, { maxRetries: 3 });
            expect(result).toBe('success');
            expect(attempts).toBe(3);
        });

        it('should not retry on non-retryable errors', async () => {
            let attempts = 0;
            const fn = async () => {
                attempts++;
                throw new ValidationError('Invalid input');
            };

            await expect(retryWithBackoff(fn, { maxRetries: 3 })).rejects.toThrow();
            expect(attempts).toBe(1); // Should fail immediately
        });

        it('should respect max retries', async () => {
            let attempts = 0;
            const fn = async () => {
                attempts++;
                throw new NetworkError('Always fails');
            };

            await expect(retryWithBackoff(fn, { maxRetries: 2 })).rejects.toThrow();
            expect(attempts).toBe(3); // Initial + 2 retries
        });

        it('should apply exponential backoff', async () => {
            const delays: number[] = [];
            const fn = async () => {
                throw new NetworkError('Fail');
            };

            const startTime = Date.now();
            try {
                await retryWithBackoff(fn, {
                    maxRetries: 2,
                    baseDelayMs: 100,
                    jitter: false, // Disable jitter for predictable testing
                    onRetry: (attempt) => {
                        delays.push(Date.now() - startTime);
                    }
                });
            } catch (e) {
                // Expected to fail
            }

            // Delays should be approximately 100ms, 200ms (exponential)
            expect(delays.length).toBe(2);
            expect(delays[0]).toBeGreaterThanOrEqual(90);
            expect(delays[1]).toBeGreaterThanOrEqual(190);
        });

        it('should add jitter to delays', async () => {
            const delays: number[] = [];
            const fn = async () => {
                throw new NetworkError('Fail');
            };

            try {
                await retryWithBackoff(fn, {
                    maxRetries: 3,
                    baseDelayMs: 1000,
                    jitter: true,
                    onRetry: (attempt, error) => {
                        delays.push(Date.now());
                    }
                });
            } catch (e) { }

            // With jitter, delays should vary (not exactly exponential)
            expect(delays.length).toBe(3);
        });
    });

    describe('Specialized Retry Functions', () => {
        it('should use database-specific retry settings', async () => {
            let attempts = 0;
            const fn = async () => {
                attempts++;
                if (attempts < 2) {
                    throw new DatabaseError('Connection lost');
                }
                return 'success';
            };

            const result = await retryDatabaseOperation(fn);
            expect(result).toBe('success');
            expect(attempts).toBe(2);
        });

        it('should use network-specific retry settings', async () => {
            let attempts = 0;
            const fn = async () => {
                attempts++;
                if (attempts < 3) {
                    throw new NetworkError('Timeout');
                }
                return 'success';
            };

            const result = await retryNetworkOperation(fn);
            expect(result).toBe('success');
        });
    });

    describe('Error Classification', () => {
        it('should create NetworkError as retryable', () => {
            const error = new NetworkError('Connection failed');
            expect(error.isRetryable).toBe(true);
            expect(error.code).toBe('NETWORK_ERROR');
            expect(error.category).toBe('NETWORK');
        });

        it('should create ValidationError as non-retryable', () => {
            const error = new ValidationError('Invalid input');
            expect(error.isRetryable).toBe(false);
            expect(error.code).toBe('VALIDATION_ERROR');
            expect(error.category).toBe('VALIDATION');
        });

        it('should serialize errors to JSON', () => {
            const error = new NetworkError('Test error', {
                userId: 'user-123',
                sessionId: 'session-456',
                timestamp: new Date()
            });

            const json = error.toJSON();
            expect(json.code).toBe('NETWORK_ERROR');
            expect(json.isRetryable).toBe(true);
            expect(json.context?.userId).toBe('user-123');
        });
    });

    describe('Degradation Service', () => {
        it('should use fallback on primary failure', async () => {
            const primary = async () => {
                throw new Error('Primary failed');
            };
            const fallback = async () => 'fallback result';

            const result = await degradationService.executeWithFallback(
                primary,
                fallback,
                'Test Operation'
            );

            expect(result).toBe('fallback result');
        });

        it('should try all strategies in order', async () => {
            const attempts: number[] = [];

            const strategies = [
                async () => {
                    attempts.push(1);
                    throw new Error('Strategy 1 failed');
                },
                async () => {
                    attempts.push(2);
                    throw new Error('Strategy 2 failed');
                },
                async () => {
                    attempts.push(3);
                    return 'success';
                }
            ];

            const result = await degradationService.executeWithFallbacks(
                strategies,
                'Test Operation'
            );

            expect(result).toBe('success');
            expect(attempts).toEqual([1, 2, 3]);
        });

        it('should throw if all strategies fail', async () => {
            const strategies = [
                async () => { throw new Error('Fail 1'); },
                async () => { throw new Error('Fail 2'); }
            ];

            await expect(
                degradationService.executeWithFallbacks(strategies, 'Test')
            ).rejects.toThrow('Fail 2');
        });
    });
});
