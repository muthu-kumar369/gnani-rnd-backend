// backend/src/server/express_server.ts
import express, { Application, Request, Response } from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import { PORT } from '../configs/config.js'; // Use PORT from config
import logger from '../utils/logger.js'; // Updated path for logger
import apiRoutes from '../routes/index.js'; // Import consolidated routes from src/routes/index.js
import errorHandler from '../utils/error_handler.js';

const app: Application = express();

// Middleware
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

export const startExpressServer = (): void => {
    app.listen(PORT, () => {
        logger.info(`Express.js server listening on port ${PORT}`);
    });
};

export { app };
