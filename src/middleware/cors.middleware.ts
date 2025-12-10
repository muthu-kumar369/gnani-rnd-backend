// src/middleware/cors.middleware.ts
import cors from 'cors';

// Example CORS middleware configuration
const corsMiddleware = cors({
    origin: process.env.CORS_ORIGIN || '*', // Allow all origins for development, specify for production
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
    optionsSuccessStatus: 204
});

export default corsMiddleware;