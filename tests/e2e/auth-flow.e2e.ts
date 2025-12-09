import { test, expect } from '@playwright/test';

const API_BASE = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Authentication Flow', () => {
    let authToken: string;
    let refreshToken: string;
    const testUser = {
        email: `test-${Date.now()}@example.com`,
        password: 'Test123!@#',
        name: 'Test User'
    };

    test('should register a new user', async ({ request }) => {
        const response = await request.post(`${API_BASE}/api/auth/register`, {
            data: testUser
        });

        expect(response.status()).toBe(201);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.user).toBeDefined();
        expect(data.user.email).toBe(testUser.email);
        expect(data.token).toBeDefined();

        authToken = data.token;
    });

    test('should login with credentials', async ({ request }) => {
        const response = await request.post(`${API_BASE}/api/auth/login`, {
            data: {
                email: testUser.email,
                password: testUser.password
            }
        });

        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.token).toBeDefined();
        expect(data.refreshToken).toBeDefined();

        authToken = data.token;
        refreshToken = data.refreshToken;
    });

    test('should access protected route with token', async ({ request }) => {
        const response = await request.get(`${API_BASE}/api/user/me`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.email).toBe(testUser.email);
    });

    test('should refresh access token', async ({ request }) => {
        const response = await request.post(`${API_BASE}/api/auth/refresh-token`, {
            data: {
                refreshToken
            }
        });

        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.token).toBeDefined();
        expect(data.token).not.toBe(authToken);
    });

    test('should logout successfully', async ({ request }) => {
        const response = await request.post(`${API_BASE}/api/auth/logout`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
    });

    test('should reject invalid credentials', async ({ request }) => {
        const response = await request.post(`${API_BASE}/api/auth/login`, {
            data: {
                email: testUser.email,
                password: 'WrongPassword123'
            }
        });

        expect(response.status()).toBe(401);
    });

    test('should reject access without token', async ({ request }) => {
        const response = await request.get(`${API_BASE}/api/user/me`);
        expect(response.status()).toBe(401);
    });
});
