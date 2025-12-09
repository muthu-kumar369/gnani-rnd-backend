import { z } from 'zod';
import {
    userIdSchema,
    sessionIdSchema,
    messageSchema,
    createSessionSchema,
    llmRequestSchema,
    toolExecutionSchema,
    audioChunkSchema,
    memoryQuerySchema,
    vectorSearchSchema,
    fileUploadSchema,
    userUpdateSchema,
    sanitizeFilename,
    sanitizeCommandInput,
} from '../../../src/core/validation/schemas';

describe('Validation Schemas', () => {
    describe('userIdSchema', () => {
        it('should validate valid UUID', () => {
            const validId = '123e4567-e89b-12d3-a456-426614174000';
            expect(() => userIdSchema.parse(validId)).not.toThrow();
        });

        it('should reject invalid UUID', () => {
            expect(() => userIdSchema.parse('not-a-uuid')).toThrow();
            expect(() => userIdSchema.parse('12345')).toThrow();
        });
    });

    describe('sessionIdSchema', () => {
        it('should validate valid session ID', () => {
            const validId = '123e4567-e89b-12d3-a456-426614174000';
            expect(() => sessionIdSchema.parse(validId)).not.toThrow();
        });

        it('should reject invalid session ID', () => {
            expect(() => sessionIdSchema.parse('invalid')).toThrow();
        });
    });

    describe('messageSchema', () => {
        it('should validate valid message', () => {
            const validMessage = {
                content: 'Hello world',
                role: 'user' as const,
            };

            const result = messageSchema.parse(validMessage);
            expect(result.content).toBe('Hello world');
            expect(result.role).toBe('user');
        });

        it('should sanitize HTML in content', () => {
            const message = {
                content: '<script>alert("xss")</script>Hello',
                role: 'user' as const,
            };

            const result = messageSchema.parse(message);
            expect(result.content).not.toContain('<script>');
            expect(result.content).toContain('Hello');
        });

        it('should reject empty content', () => {
            const message = {
                content: '',
                role: 'user' as const,
            };

            expect(() => messageSchema.parse(message)).toThrow();
        });

        it('should reject content that is too long', () => {
            const message = {
                content: 'a'.repeat(10001),
                role: 'user' as const,
            };

            expect(() => messageSchema.parse(message)).toThrow();
        });

        it('should validate all role types', () => {
            const roles = ['user', 'assistant', 'system'] as const;

            roles.forEach(role => {
                const message = { content: 'test', role };
                expect(() => messageSchema.parse(message)).not.toThrow();
            });
        });

        it('should reject invalid role', () => {
            const message = {
                content: 'test',
                role: 'invalid',
            };

            expect(() => messageSchema.parse(message)).toThrow();
        });
    });

    describe('createSessionSchema', () => {
        it('should validate valid session creation', () => {
            const validSession = {
                userId: '123e4567-e89b-12d3-a456-426614174000',
            };

            expect(() => createSessionSchema.parse(validSession)).not.toThrow();
        });

        it('should validate with optional fields', () => {
            const session = {
                userId: '123e4567-e89b-12d3-a456-426614174000',
                conversationId: '223e4567-e89b-12d3-a456-426614174000',
                systemPrompt: 'You are a helpful assistant',
                model: 'llama3.1',
            };

            expect(() => createSessionSchema.parse(session)).not.toThrow();
        });

        it('should sanitize system prompt', () => {
            const session = {
                userId: '123e4567-e89b-12d3-a456-426614174000',
                systemPrompt: '<b>Bold</b> text',
            };

            const result = createSessionSchema.parse(session);
            expect(result.systemPrompt).not.toContain('<b>');
        });

        it('should reject invalid model name', () => {
            const session = {
                userId: '123e4567-e89b-12d3-a456-426614174000',
                model: 'invalid model!',
            };

            expect(() => createSessionSchema.parse(session)).toThrow();
        });
    });

    describe('llmRequestSchema', () => {
        it('should validate valid LLM request', () => {
            const request = {
                messages: [{ content: 'Hello', role: 'user' as const }],
                model: 'llama3.1',
            };

            expect(() => llmRequestSchema.parse(request)).not.toThrow();
        });

        it('should validate temperature range', () => {
            const request = {
                messages: [{ content: 'test', role: 'user' as const }],
                model: 'llama3.1',
                temperature: 0.7,
            };

            expect(() => llmRequestSchema.parse(request)).not.toThrow();
        });

        it('should reject temperature out of range', () => {
            const request = {
                messages: [{ content: 'test', role: 'user' as const }],
                model: 'llama3.1',
                temperature: 3.0,
            };

            expect(() => llmRequestSchema.parse(request)).toThrow();
        });

        it('should validate maxTokens', () => {
            const request = {
                messages: [{ content: 'test', role: 'user' as const }],
                model: 'llama3.1',
                maxTokens: 2048,
            };

            expect(() => llmRequestSchema.parse(request)).not.toThrow();
        });

        it('should reject maxTokens over limit', () => {
            const request = {
                messages: [{ content: 'test', role: 'user' as const }],
                model: 'llama3.1',
                maxTokens: 10000,
            };

            expect(() => llmRequestSchema.parse(request)).toThrow();
        });
    });

    describe('audioChunkSchema', () => {
        it('should validate valid audio chunk', () => {
            const chunk = {
                sessionId: '123e4567-e89b-12d3-a456-426614174000',
                audioData: Buffer.from([1, 2, 3, 4]),
                sampleRate: 16000,
            };

            expect(() => audioChunkSchema.parse(chunk)).not.toThrow();
        });

        it('should reject empty audio data', () => {
            const chunk = {
                sessionId: '123e4567-e89b-12d3-a456-426614174000',
                audioData: Buffer.from([]),
                sampleRate: 16000,
            };

            expect(() => audioChunkSchema.parse(chunk)).toThrow();
        });

        it('should reject audio chunk too large', () => {
            const chunk = {
                sessionId: '123e4567-e89b-12d3-a456-426614174000',
                audioData: Buffer.alloc(2 * 1024 * 1024), // 2MB
                sampleRate: 16000,
            };

            expect(() => audioChunkSchema.parse(chunk)).toThrow();
        });

        it('should validate sample rates', () => {
            const validRates = [8000, 16000, 44100, 48000];

            validRates.forEach(rate => {
                const chunk = {
                    sessionId: '123e4567-e89b-12d3-a456-426614174000',
                    audioData: Buffer.from([1, 2, 3]),
                    sampleRate: rate,
                };

                expect(() => audioChunkSchema.parse(chunk)).not.toThrow();
            });
        });

        it('should reject invalid sample rate', () => {
            const chunk = {
                sessionId: '123e4567-e89b-12d3-a456-426614174000',
                audioData: Buffer.from([1, 2, 3]),
                sampleRate: 22050,
            };

            expect(() => audioChunkSchema.parse(chunk)).toThrow();
        });
    });

    describe('sanitizeFilename', () => {
        it('should remove path traversal attempts', () => {
            const filename = '../../../etc/passwd';
            const sanitized = sanitizeFilename(filename);

            expect(sanitized).not.toContain('..');
            expect(sanitized).not.toContain('/');
        });

        it('should remove special characters', () => {
            const filename = 'file@name!.txt';
            const sanitized = sanitizeFilename(filename);

            expect(sanitized).toMatch(/^[a-zA-Z0-9._-]+$/);
        });

        it('should truncate long filenames', () => {
            const filename = 'a'.repeat(300) + '.txt';
            const sanitized = sanitizeFilename(filename);

            expect(sanitized.length).toBeLessThanOrEqual(255);
        });
    });

    describe('sanitizeCommandInput', () => {
        it('should remove shell injection characters', () => {
            const input = 'ls; rm -rf /';
            const sanitized = sanitizeCommandInput(input);

            expect(sanitized).not.toContain(';');
            expect(sanitized).toBe('ls rm -rf ');
        });

        it('should remove pipe characters', () => {
            const input = 'cat file | grep secret';
            const sanitized = sanitizeCommandInput(input);

            expect(sanitized).not.toContain('|');
        });

        it('should remove backticks', () => {
            const input = 'echo `whoami`';
            const sanitized = sanitizeCommandInput(input);

            expect(sanitized).not.toContain('`');
        });
    });
});
