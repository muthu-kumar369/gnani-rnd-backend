// backend/src/server/express_server.ts
import http from 'http';
import express, { Application, Request, Response } from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import { PORT } from './config/env.config.js'; // Use PORT from config
import logger from './core/logger/logger.js'; // Updated path for logger
import apiRoutes from './routes/index.js'; // Import consolidated routes from src/routes/index.js
import errorHandler from './core/http/error.middleware.js';
import corsMiddleware from './middleware/cors.middleware.js';
import { globalRateLimiter } from './middleware/rate-limit.middleware.js';
import healthRoutes from './routes/health.routes.js';
import rateLimit from 'express-rate-limit';
import { startTracing } from './core/tracing/tracer.js';

// Start tracing before app initialization
startTracing();

const app: Application = express();

// Middleware
// NEW: Specific rate limiters
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many login attempts from this IP, please try again after 15 minutes'
});

const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // Limit each IP to 60 requests per windowMs
    message: 'Too many API requests, please slow down'
});

app.use(globalRateLimiter); // Apply global rate limiting first
app.use('/api/auth', authLimiter); // Apply stricter limit to auth routes
app.use('/api', apiLimiter); // Apply general limit to other API routes
app.use(corsMiddleware);
app.use(bodyParser.json());
app.use(morgan('combined', { stream: { write: (message: string) => logger.info(message.trim()) } })); // Log HTTP requests

// Routes
app.use('/', healthRoutes); // Register health routes at root level (e.g. /health, /ready)
app.use('/api', apiRoutes);

// General endpoint (can remain as is or be removed if all routes are in modular files)
app.get('/', (req: Request, res: Response) => {
    res.send('GNANI Backend is running!');
});

// Error handling middleware
app.use(errorHandler);

export const startExpressServer = (): http.Server => {
    const server = app.listen(PORT, () => {
        logger.info(`Express.js server listening on port ${PORT}`);
    });
    return server;
};

export { app };
