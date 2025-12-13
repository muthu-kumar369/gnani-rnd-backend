import { z } from 'zod';

export const createConversationSchema = z.object({
    body: z.object({
        message: z.string().optional(), // Initial message is optional
        systemPrompt: z.string().optional(),
    }),
});

export const updateConversationTitleSchema = z.object({
    params: z.object({
        id: z.string(),
    }),
    body: z.object({
        title: z.string().min(1),
    }),
});

export const updateSystemPromptSchema = z.object({
    params: z.object({
        id: z.string(),
    }),
    body: z.object({
        systemPrompt: z.string(),
    }),
});

export const editMessageSchema = z.object({
    params: z.object({
        id: z.string(),
    }),
    body: z.object({
        messageId: z.string(),
        content: z.string().min(1),
    }),
});

export const searchConversationSchema = z.object({
    body: z.object({
        query: z.string(),
        limit: z.number().optional(),
        mode: z.enum(['basic', 'semantic', 'hybrid']).optional(),
        filters: z.any().optional(),
    }),
});
