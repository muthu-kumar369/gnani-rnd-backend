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

        // Fix for duplicate key error on devices.deviceId
        try {
            const usersCollection = mongoose.connection.collection('users');
            // Check if index exists before dropping to avoid errors
            const indexes = await usersCollection.indexes();
            const indexName = 'devices.deviceId_1';
            const indexExists = indexes.some(index => index.name === indexName);

            if (indexExists) {
                await usersCollection.dropIndex(indexName);
                logger.info(`Dropped legacy unique index: ${indexName}`);
            }
        } catch (indexError: any) {
            // Log warning but don't fail connection
            logger.warn(`Attempted to drop index devices.deviceId_1 but failed (this is expected if it doesn't exist): ${indexError.message}`);
        }

        // Fix for duplicate key error on sessionId (legacy)
        try {
            const conversationsCollection = mongoose.connection.collection('conversations');
            const indexes = await conversationsCollection.indexes();
            const indexName = 'sessionId_1';
            const indexExists = indexes.some(index => index.name === indexName);

            if (indexExists) {
                await conversationsCollection.dropIndex(indexName);
                logger.info(`Dropped legacy unique index: ${indexName} from conversations`);
            }
        } catch (indexError: any) {
            logger.warn(`Attempted to drop index sessionId_1 but failed: ${indexError.message}`);
        }
    } catch (err: any) {
        logger.error(`MongoDB connection error: ${err.message}`);
        process.exit(1); // Exit process with failure
    }
};

export default connectDB;
