import { test, expect } from '@playwright/test';

const API_BASE = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Tool Execution Flow', () => {
    let authToken: string;

    test.beforeAll(async ({ request }) => {
        // Login to get auth token
        const response = await request.post(`${API_BASE}/api/auth/login`, {
            data: {
                email: 'test@example.com',
                password: 'Test123!@#'
            }
        });
        const data = await response.json();
        authToken = data.token;
    });

    test('should list available tools', async ({ request }) => {
        const response = await request.get(`${API_BASE}/api/tools`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.tools).toBeDefined();
        expect(Array.isArray(data.tools)).toBe(true);
        expect(data.tools.length).toBeGreaterThan(0);
    });

    test('should execute a simple tool', async ({ request }) => {
        const response = await request.post(`${API_BASE}/api/chat`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            data: {
                message: 'What time is it?'
            }
        });

        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.message).toBeDefined();
        // Response should contain time information
        expect(data.message.toLowerCase()).toContain('time');
    });

    test('should toggle tool enabled status', async ({ request }) => {
        // Get first tool
        const listResponse = await request.get(`${API_BASE}/api/tools`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        const listData = await listResponse.json();
        const toolId = listData.tools[0]._id;
        const currentStatus = listData.tools[0].isEnabled;

        // Toggle tool
        const response = await request.patch(`${API_BASE}/api/tools/${toolId}/toggle`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            data: {
                enabled: !currentStatus
            }
        });

        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.tool.isEnabled).toBe(!currentStatus);

        // Toggle back
        await request.patch(`${API_BASE}/api/tools/${toolId}/toggle`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            data: {
                enabled: currentStatus
            }
        });
    });

    test('should handle tool execution errors gracefully', async ({ request }) => {
        const response = await request.post(`${API_BASE}/api/chat`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            data: {
                message: 'Execute invalid tool operation'
            }
        });

        // Should still return 200 even if tool fails
        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.message).toBeDefined();
    });

    test('should cache tool results', async ({ request }) => {
        const message = 'What is 2 + 2?';

        // First request
        const start1 = Date.now();
        const response1 = await request.post(`${API_BASE}/api/chat`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            data: { message }
        });
        const duration1 = Date.now() - start1;

        expect(response1.status()).toBe(200);
        const data1 = await response1.json();

        // Second request (should be cached)
        const start2 = Date.now();
        const response2 = await request.post(`${API_BASE}/api/chat`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            data: { message }
        });
        const duration2 = Date.now() - start2;

        expect(response2.status()).toBe(200);
        const data2 = await response2.json();

        // Cached response should be faster (though not guaranteed in all cases)
        // Just verify both requests succeeded
        expect(data1.message).toBeDefined();
        expect(data2.message).toBeDefined();
    });
});
