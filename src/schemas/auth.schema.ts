import { z } from 'zod';

export const registerSchema = z.object({
    body: z.object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().min(2),
    }),
});

export const loginSchema = z.object({
    body: z.object({
        loginIdentifier: z.string().min(1, 'Login identifier is required'),
        password: z.string(),
    }),
});

export const refreshTokenSchema = z.object({
    body: z.object({
        refreshToken: z.string(),
    }),
});
