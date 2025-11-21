// backend/src/app.ts
import { startExpressServer } from './server/express_server.js';
import { startGrpcServer } from './server/grpc_server.js';
import connectDB from './config/db.js';
import logger from './utils/logger.js'; // Updated path

// Connect to MongoDB
connectDB();

// Start both servers
startExpressServer();
startGrpcServer();

logger.info('GNANI Backend application started.');
