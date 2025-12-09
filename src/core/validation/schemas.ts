import { z } from 'zod';

/**
 * Sanitization functions
 */
function sanitizeHtml(input: string): string {
    return input
        .replace(/<[^>]*>/g, '')  // Remove HTML tags
        .replace(/[<>]/g, '')     // Remove remaining < >
        .trim();
}

export function sanitizeFilename(filename: string): string {
    return filename
        .replace(/\.\./g, '')
        .replace(/[\/\\]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .substring(0, 255);
}

export function sanitizeCommandInput(input: string): string {
    return input
        .replace(/[;&|`$()]/g, '')
        .trim();
}

/**
 * Common validation schemas
 */

// User ID validation
export const userIdSchema = z.string().uuid('Invalid user ID format');

// Session ID validation
export const sessionIdSchema = z.string().uuid('Invalid session ID format');

// Message validation
export const messageSchema = z.object({
    content: z.string()
        .min(1, 'Message cannot be empty')
        .max(10000, 'Message too long (max 10000 characters)')
        .transform((val) => sanitizeHtml(val)),
    role: z.enum(['user', 'assistant', 'system']),
    metadata: z.record(z.string(), z.any()).optional(),
});

// Session creation validation
export const createSessionSchema = z.object({
    userId: userIdSchema,
    conversationId: z.string().uuid().optional(),
    systemPrompt: z.string()
        .max(5000, 'System prompt too long')
        .optional()
        .transform((val) => val ? sanitizeHtml(val) : val),
    model: z.string()
        .regex(/^[a-zA-Z0-9\-_.]+$/, 'Invalid model name')
        .optional(),
    metadata: z.record(z.string(), z.any()).optional(),
});

// LLM request validation
export const llmRequestSchema = z.object({
    messages: z.array(messageSchema)
        .min(1, 'At least one message required')
        .max(100, 'Too many messages'),
    model: z.string()
        .regex(/^[a-zA-Z0-9\-_.]+$/, 'Invalid model name'),
    temperature: z.number()
        .min(0)
        .max(2)
        .optional(),
    maxTokens: z.number()
        .int()
        .positive()
        .max(8192)
        .optional(),
    stream: z.boolean().optional(),
});

// Tool execution validation
export const toolExecutionSchema = z.object({
    toolName: z.string()
        .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid tool name'),
    parameters: z.record(z.string(), z.any()),
    sessionId: sessionIdSchema,
});

// Audio chunk validation
export const audioChunkSchema = z.object({
    sessionId: sessionIdSchema,
    audioData: z.instanceof(Buffer)
        .refine(buf => buf.length > 0, 'Audio data cannot be empty')
        .refine(buf => buf.length <= 1024 * 1024, 'Audio chunk too large (max 1MB)'),
    sampleRate: z.number()
        .int()
        .refine(rate => [8000, 16000, 44100, 48000].includes(rate), 'Invalid sample rate'),
    isFinal: z.boolean().optional(),
});

// Memory query validation
export const memoryQuerySchema = z.object({
    userId: userIdSchema,
    query: z.string()
        .min(1, 'Query cannot be empty')
        .max(1000, 'Query too long'),
    limit: z.number()
        .int()
        .positive()
        .max(100)
        .optional(),
    filters: z.record(z.string(), z.any()).optional(),
});

// Vector search validation
export const vectorSearchSchema = z.object({
    query: z.string()
        .min(1, 'Query cannot be empty')
        .max(1000, 'Query too long'),
    limit: z.number()
        .int()
        .positive()
        .max(100)
        .default(10),
    collection: z.string()
        .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid collection name')
        .optional(),
    filters: z.record(z.string(), z.any()).optional(),
});

// File upload validation
export const fileUploadSchema = z.object({
    filename: z.string()
        .min(1)
        .max(255)
        .transform((val) => sanitizeFilename(val)),
    mimeType: z.string()
        .regex(/^[a-zA-Z0-9\-+.]+\/[a-zA-Z0-9\-+.]+$/, 'Invalid MIME type'),
    size: z.number()
        .int()
        .positive()
        .max(10 * 1024 * 1024, 'File too large (max 10MB)'),
    data: z.instanceof(Buffer),
});

// User update validation
export const userUpdateSchema = z.object({
    name: z.string()
        .min(1)
        .max(100)
        .transform((val) => sanitizeHtml(val))
        .optional(),
    email: z.string()
        .email('Invalid email format')
        .optional(),
    preferences: z.record(z.string(), z.any()).optional(),
});
