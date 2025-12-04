import { z } from 'zod';

export const toggleToolSchema = z.object({
    params: z.object({
        id: z.string(),
    }),
    body: z.object({
        isEnabled: z.boolean(),
    }),
});

export const updateToolConfigSchema = z.object({
    params: z.object({
        id: z.string(),
    }),
    body: z.object({
        config: z.record(z.string(), z.any()),
    }),
});
