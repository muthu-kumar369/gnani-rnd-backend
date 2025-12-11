// backend/src/server/express_server.ts
import http from 'http';
import express, { Application, Request, Response } from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import compression from 'compression'; // STAGE 14
import { PORT } from './config/env.config.js'; // Use PORT from config
import logger from './core/logger/logger.js'; // Updated path for logger
import apiRoutes from './routes/index.js'; // Import consolidated routes from src/routes/index.js
import stage5Routes from './routes/stage5.routes.js'; // Stage 5: Advanced features
import errorHandler from './core/http/error.middleware.js';
import corsMiddleware from './middleware/cors.middleware.js';
import { globalRateLimiter, strictRateLimiter } from './middleware/rate-limit.middleware.js';
import healthRoutes from './routes/health.routes.js';
import metricsRoutes from './routes/metrics.routes.js'; // Stage 6
import { startTracing } from './core/tracing/tracer.js';
import { configureSecurityMiddleware } from './middleware/security.middleware.js';
import { requestIdMiddleware } from './middleware/request-id.middleware.js'; // Stage 5
import { metricsMiddleware } from './middleware/metrics.middleware.js'; // Stage 6
import { setupSwagger } from './docs/swagger.config.js'; // Stage 12: API Documentation
// import { startTracing } from './core/tracing/tracer.js';

// Start tracing before app initialization
// startTracing(); // Temporarily disabled due to initialization issues

const app: Application = express();

// Security Middleware (Helmet)
configureSecurityMiddleware(app);

// Stage 5: Request ID middleware for request correlation
app.use(requestIdMiddleware);

// Stage 6: Metrics middleware for HTTP tracking
app.use(metricsMiddleware);

// STAGE 14 Step 3: Response compression
app.use(compression({
    filter: (req, res) => {
        // Don't compress if client explicitly requests no compression
        if (req.headers['x-no-compression']) {
            return false;
        }
        // Use default compression filter
        return compression.filter(req, res);
    },
    level: 6, // Compression level (0-9, 6 is default)
    threshold: 1024 // Only compress responses larger than 1KB
}));

// Middleware
app.use(globalRateLimiter); // Apply global rate limiting first
app.use('/api/v1/auth', strictRateLimiter); // Apply stricter limit to auth routes
// app.use('/api', apiLimiter); // Removed redundant apiLimiter, global covers it or use specific if needed
app.use(corsMiddleware);
app.use(bodyParser.json());
app.use(morgan('combined', { stream: { write: (message: string) => logger.info(message.trim()) } })); // Log HTTP requests

// Routes
app.use('/health', healthRoutes); // Register health routes (e.g. /health/live, /health/ready)
app.use('/', metricsRoutes); // Stage 6: Prometheus metrics endpoint
app.use('/api/v1', apiRoutes);
app.use('/api/v1/stage5', stage5Routes); // Stage 5: Advanced features routes

// Stage 12: Setup Swagger API Documentation
setupSwagger(app);

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
