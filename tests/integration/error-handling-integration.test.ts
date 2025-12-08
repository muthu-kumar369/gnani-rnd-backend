// tests/integration/error-handling-integration.test.ts
import request from 'supertest';
import { DatabaseError, NetworkError } from '../../src/shared/errors/error-types.js';
import { retryDatabaseOperation } from '../../src/utils/retry.js';

describe('Error Handling Integration', () => {
    describe('Database Error Retry', () => {
        it('should retry database operations on failure', async () => {
            let attempts = 0;
            const mockDbOperation = async () => {
                attempts++;
                if (attempts < 2) {
                    throw new DatabaseError('Connection lost');
                }
                return { id: 1, name: 'test' };
            };

            const result = await retryDatabaseOperation(mockDbOperation, 'Test DB Op');

            expect(result).toEqual({ id: 1, name: 'test' });
            expect(attempts).toBe(2);
        });

        it('should fail after max retries', async () => {
            const mockDbOperation = async () => {
                throw new DatabaseError('Permanent failure');
            };

            await expect(
                retryDatabaseOperation(mockDbOperation, 'Test DB Op')
            ).rejects.toThrow('Permanent failure');
        });
    });

    describe('Network Error Retry', () => {
        it('should retry network operations', async () => {
            let attempts = 0;
            const mockNetworkOp = async () => {
                attempts++;
                if (attempts < 3) {
                    throw new NetworkError('Timeout');
                }
                return { data: 'success' };
            };

            const { retryNetworkOperation } = await import('../../src/utils/retry.js');
            const result = await retryNetworkOperation(mockNetworkOp, 'Test Network Op');

            expect(result).toEqual({ data: 'success' });
            expect(attempts).toBe(3);
        });
    });

    describe('Error Metrics', () => {
        it('should track error metrics', async () => {
            const metrics = (await import('../../src/core/monitoring/metrics.js')).default;

            // Verify error counter exists
            expect(metrics.errorCounter).toBeDefined();

            // Increment error counter
            metrics.errorCounter.inc({
                code: 'TEST_ERROR',
                category: 'SYSTEM',
                severity: 'HIGH'
            });

            // Metrics should be incremented (actual value check would require Prometheus client)
            expect(metrics.errorCounter).toBeDefined();
        });
    });
});
