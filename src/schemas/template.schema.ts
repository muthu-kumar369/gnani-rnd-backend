import { z } from 'zod';

export const createTemplateSchema = z.object({
    body: z.object({
        title: z.string().min(1),
        content: z.string().min(1),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
        isPublic: z.boolean().optional(),
    }),
});

export const updateTemplateSchema = z.object({
    params: z.object({
        id: z.string(),
    }),
    body: z.object({
        title: z.string().min(1).optional(),
        content: z.string().min(1).optional(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
        isPublic: z.boolean().optional(),
    }),
});
