import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validate = (schema: ZodSchema) => async (req: Request, res: Response, next: NextFunction) => {
    try {
        await schema.parseAsync({
            body: req.body,
            query: req.query,
            params: req.params,
        });
        return next();
    } catch (error: any) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                error: 'Validation Error',
                details: error.issues.map((err) => ({
                    field: err.path.join('.') || 'unknown',
                    message: err.message,
                })),
            });
        }
        return res.status(400).json({ error: 'Invalid Request' });
    }
};
