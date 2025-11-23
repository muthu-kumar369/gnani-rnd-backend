// backend/src/app.ts
import { startExpressServer } from './server.js';
import { startGrpcServer } from './grpc.js';
import connectDB from './config/database.config.js';
import logger from './core/logger/logger.js';
import { Server as SocketIOServer } from 'socket.io';
import AssistantSocket from './websocket/assistant.socket.js';
import UserSocket from './websocket/user.socket.js';

logger.info('App initialization process started, checking for reloads...');

// Connect to MongoDB
connectDB();

// Start Express.js server and get the http.Server instance
const httpServer = startExpressServer();
startGrpcServer();

// Initialize Socket.IO
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: "*", // Adjust as needed for your frontend URL
        methods: ["GET", "POST"]
    }
});

// Initialize Socket.IO handlers
new AssistantSocket(io);
new UserSocket(io);

logger.info('GNANI Backend application started.');
