// src/config/db.ts
import mongoose from 'mongoose';
import { createContextualLogger } from '../core/logger/logger.js'; // Import logger factory
import { MONGODB_URI } from './env.config.js';

const logger = createContextualLogger({ module: 'DB' }); // Create a logger instance for this module

const connectDB = async (): Promise<void> => {
    try {
        if (!MONGODB_URI) {
            logger.error('MongoDB URI is not defined. Please set MONGODB_URI in your environment variables.');
            process.exit(1);
        }
        await mongoose.connect(MONGODB_URI);
        logger.info('MongoDB connected successfully');
    } catch (err: any) {
        logger.error(`MongoDB connection error: ${err.message}`);
        process.exit(1); // Exit process with failure
    }
};

export default connectDB;
