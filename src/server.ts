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

const app: Application = express();

// Middleware
app.use(globalRateLimiter); // Apply global rate limiting first
app.use(corsMiddleware);
app.use(bodyParser.json());
app.use(morgan('combined', { stream: { write: (message: string) => logger.info(message.trim()) } })); // Log HTTP requests

// Routes
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
