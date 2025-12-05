import { z } from 'zod';

export const createTemplateSchema = z.object({
    body: z.object({
        name: z.string().min(1),
        systemPrompt: z.string().min(1),
        description: z.string().optional(),
        icon: z.string().optional(),
        tags: z.array(z.string()).optional(),
        isPublic: z.boolean().optional(),
    }),
});

export const updateTemplateSchema = z.object({
    params: z.object({
        id: z.string(),
    }),
    body: z.object({
        name: z.string().min(1).optional(),
        systemPrompt: z.string().min(1).optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        tags: z.array(z.string()).optional(),
        isPublic: z.boolean().optional(),
    }),
});
