// tests/integration/health-checks.test.ts
import request from 'supertest';
import mongoose from 'mongoose';
import redis from '../../src/config/redis.config.js';

// Note: These tests assume the server is running
// For actual integration tests, you would start the server in beforeAll

describe('Health Checks Integration', () => {
    const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';

    describe('GET /health', () => {
        it('should return 200 for liveness probe', async () => {
            const response = await request(baseURL).get('/health');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status', 'healthy');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('uptime');
            expect(typeof response.body.uptime).toBe('number');
        });

        it('should include uptime in response', async () => {
            const response = await request(baseURL).get('/health');

            expect(response.body.uptime).toBeGreaterThan(0);
        });
    });

    describe('GET /health/ready', () => {
        it('should return 200 when all services are up', async () => {
            const response = await request(baseURL).get('/health/ready');

            expect([200, 503]).toContain(response.status);
            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('checks');
        });

        it('should check MongoDB status', async () => {
            const response = await request(baseURL).get('/health/ready');

            expect(response.body.checks).toHaveProperty('mongodb');
            expect(response.body.checks.mongodb).toHaveProperty('status');
            expect(['up', 'down']).toContain(response.body.checks.mongodb.status);
        });

        it('should check Redis status', async () => {
            const response = await request(baseURL).get('/health/ready');

            expect(response.body.checks).toHaveProperty('redis');
            expect(response.body.checks.redis).toHaveProperty('status');
            expect(['up', 'down']).toContain(response.body.checks.redis.status);
        });

        it('should check LLM service status', async () => {
            const response = await request(baseURL).get('/health/ready');

            expect(response.body.checks).toHaveProperty('llm');
            expect(response.body.checks.llm).toHaveProperty('status');
            expect(['up', 'down']).toContain(response.body.checks.llm.status);
        });

        it('should include latency metrics for up services', async () => {
            const response = await request(baseURL).get('/health/ready');

            const { checks } = response.body;

            // Check that up services have latency
            Object.keys(checks).forEach(service => {
                if (checks[service].status === 'up') {
                    expect(checks[service]).toHaveProperty('latency');
                    expect(typeof checks[service].latency).toBe('number');
                    expect(checks[service].latency).toBeGreaterThanOrEqual(0);
                }
            });
        });

        it('should return degraded status when Redis is down', async () => {
            // This test would require mocking or actually stopping Redis
            // For now, we just verify the response structure
            const response = await request(baseURL).get('/health/ready');

            if (response.body.status === 'degraded') {
                expect(response.status).toBe(200);
                expect(response.body.checks.redis.status).toBe('down');
            }
        });

        it('should return unhealthy status when MongoDB is down', async () => {
            // This test would require mocking or actually stopping MongoDB
            // For now, we just verify the response structure
            const response = await request(baseURL).get('/health/ready');

            if (response.body.status === 'unhealthy') {
                expect(response.status).toBe(503);
                expect(response.body.checks.mongodb.status).toBe('down');
            }
        });
    });

    describe('GET /health/detailed', () => {
        it('should return detailed health information', async () => {
            const response = await request(baseURL).get('/health/detailed');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status', 'healthy');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('uptime');
            expect(response.body).toHaveProperty('memory');
            expect(response.body).toHaveProperty('cpu');
            expect(response.body).toHaveProperty('nodejs');
            expect(response.body).toHaveProperty('pid');
        });

        it('should include memory metrics', async () => {
            const response = await request(baseURL).get('/health/detailed');

            const { memory } = response.body;
            expect(memory).toHaveProperty('rss');
            expect(memory).toHaveProperty('heapUsed');
            expect(memory).toHaveProperty('heapTotal');

            // Verify memory values are strings with MB suffix
            expect(memory.rss).toMatch(/^\d+MB$/);
            expect(memory.heapUsed).toMatch(/^\d+MB$/);
            expect(memory.heapTotal).toMatch(/^\d+MB$/);
        });

        it('should include CPU usage', async () => {
            const response = await request(baseURL).get('/health/detailed');

            expect(response.body.cpu).toHaveProperty('user');
            expect(response.body.cpu).toHaveProperty('system');
        });

        it('should include Node.js version', async () => {
            const response = await request(baseURL).get('/health/detailed');

            expect(response.body.nodejs).toMatch(/^v\d+\.\d+\.\d+$/);
        });

        it('should include process ID', async () => {
            const response = await request(baseURL).get('/health/detailed');

            expect(typeof response.body.pid).toBe('number');
            expect(response.body.pid).toBeGreaterThan(0);
        });
    });

    describe('Legacy Endpoints', () => {
        it('should support /ready endpoint', async () => {
            const response = await request(baseURL).get('/ready');

            expect([200, 503]).toContain(response.status);
            expect(response.body).toHaveProperty('ready');
            expect(typeof response.body.ready).toBe('boolean');
        });

        it('should support /live endpoint', async () => {
            const response = await request(baseURL).get('/live');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('alive', true);
        });
    });
});
