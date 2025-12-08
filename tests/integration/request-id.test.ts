// tests/integration/request-id.test.ts
import request from 'supertest';

describe('Request ID Middleware Integration', () => {
    const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';

    describe('Request ID Generation', () => {
        it('should generate request ID if not provided', async () => {
            const response = await request(baseURL).get('/health');

            expect(response.headers).toHaveProperty('x-request-id');
            expect(response.headers['x-request-id']).toBeTruthy();
            expect(typeof response.headers['x-request-id']).toBe('string');
        });

        it('should use existing request ID from header', async () => {
            const customRequestId = 'test-request-123';

            const response = await request(baseURL)
                .get('/health')
                .set('X-Request-ID', customRequestId);

            expect(response.headers['x-request-id']).toBe(customRequestId);
        });

        it('should set X-Request-ID response header', async () => {
            const response = await request(baseURL).get('/health');

            expect(response.headers).toHaveProperty('x-request-id');
        });

        it('should generate different request IDs for different requests', async () => {
            const response1 = await request(baseURL).get('/health');
            const response2 = await request(baseURL).get('/health');

            expect(response1.headers['x-request-id']).toBeTruthy();
            expect(response2.headers['x-request-id']).toBeTruthy();
            expect(response1.headers['x-request-id']).not.toBe(response2.headers['x-request-id']);
        });

        it('should propagate request ID through multiple endpoints', async () => {
            const customRequestId = 'propagation-test-456';

            const healthResponse = await request(baseURL)
                .get('/health')
                .set('X-Request-ID', customRequestId);

            const readyResponse = await request(baseURL)
                .get('/health/ready')
                .set('X-Request-ID', customRequestId);

            expect(healthResponse.headers['x-request-id']).toBe(customRequestId);
            expect(readyResponse.headers['x-request-id']).toBe(customRequestId);
        });
    });
});
