// backend/src/app.ts
import { startExpressServer } from './server.js';
import { startGrpcServer } from './grpc.js';
import connectDB from './config/database.config.js';
import logger from './core/logger/logger.js';

// Connect to MongoDB
connectDB();

// Start both servers
startExpressServer();
startGrpcServer();

logger.info('GNANI Backend application started.');
