// backend/src/app.js
const { startExpressServer } = require('./server/express_server');
const { startGrpcServer } = require('./server/grpc_server');
const connectDB = require('./config/db');
const logger = require('./utils/logger'); // Updated path

// Connect to MongoDB
connectDB();

// Start both servers
startExpressServer();
startGrpcServer();

logger.info('GNANI Backend application started.');
