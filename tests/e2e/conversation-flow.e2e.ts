import { test, expect } from '@playwright/test';

const API_BASE = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Conversation Flow', () => {
    let authToken: string;
    let conversationId: string;
    let messageId: string;

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

    test('should create a new conversation', async ({ request }) => {
        const response = await request.post(`${API_BASE}/api/conversations`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            data: {
                title: 'E2E Test Conversation',
                systemPrompt: 'You are a helpful assistant.'
            }
        });

        expect(response.status()).toBe(201);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.conversation).toBeDefined();
        expect(data.conversation.title).toBe('E2E Test Conversation');

        conversationId = data.conversation.conversationId;
    });

    test('should send a message to conversation', async ({ request }) => {
        const response = await request.post(`${API_BASE}/api/conversations/${conversationId}/messages`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            data: {
                message: 'Hello, this is a test message'
            }
        });

        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.message).toBeDefined();

        messageId = data.message.messageId;
    });

    test('should retrieve conversation history', async ({ request }) => {
        const response = await request.get(`${API_BASE}/api/conversations/${conversationId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.conversation).toBeDefined();
        expect(data.conversation.messages).toBeDefined();
        expect(data.conversation.messages.length).toBeGreaterThan(0);
    });

    test('should edit a message', async ({ request }) => {
        const response = await request.post(`${API_BASE}/api/conversations/${conversationId}/edit`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            data: {
                messageId,
                newContent: 'Edited test message'
            }
        });

        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
    });

    test('should regenerate response', async ({ request }) => {
        const response = await request.post(`${API_BASE}/api/conversations/${conversationId}/regenerate`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            data: {
                messageId
            }
        });

        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
    });

    test('should update conversation title', async ({ request }) => {
        const response = await request.patch(`${API_BASE}/api/conversations/${conversationId}/title`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            data: {
                title: 'Updated E2E Test Conversation'
            }
        });

        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
    });

    test('should list all conversations', async ({ request }) => {
        const response = await request.get(`${API_BASE}/api/conversations`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.conversations).toBeDefined();
        expect(Array.isArray(data.conversations)).toBe(true);
    });

    test('should delete conversation', async ({ request }) => {
        const response = await request.delete(`${API_BASE}/api/conversations/${conversationId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
    });
});
