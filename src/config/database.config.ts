// src/config/database.config.ts
// Stage 7: Enhanced with connection pooling and performance monitoring
import mongoose from 'mongoose';
import { createContextualLogger } from '../core/logger/logger.js';
import { MONGODB_URI } from './env.config.js';
import { CircuitBreaker } from '../core/reliability/circuit-breaker.js';
import metrics from '../core/monitoring/metrics.js';

const logger = createContextualLogger({ module: 'Database' });

// Stage 2: MongoDB circuit breaker
export const mongoCircuitBreaker = new CircuitBreaker('MongoDB', {
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    requestTimeoutMs: 10000
});

const connectDB = async (): Promise<void> => {
    try {
        if (!MONGODB_URI) {
            logger.error('MongoDB URI is not defined. Please set MONGODB_URI in your environment variables.');
            process.exit(1);
        }

        // Stage 7: Enhanced connection with pooling and optimization
        await mongoCircuitBreaker.execute(async () => {
            await mongoose.connect(MONGODB_URI, {
                // Stage 7: Connection Pool Settings
                maxPoolSize: 100,        // Maximum number of connections
                minPoolSize: 10,         // Minimum number of connections to maintain
                maxIdleTimeMS: 30000,    // Close idle connections after 30s

                // Timeout Settings
                serverSelectionTimeoutMS: 10000,  // Timeout for selecting a server
                socketTimeoutMS: 45000,           // Timeout for socket operations
                connectTimeoutMS: 10000,          // Timeout for initial connection

                // Retry Settings
                retryWrites: true,
                retryReads: true,

                // Read Preference
                readPreference: 'primaryPreferred',  // Prefer primary, fallback to secondary

                // Write Concern
                w: 'majority',  // Wait for majority of replica set to acknowledge

                // Compression
                compressors: ['zlib'],  // Enable compression for network traffic
            });
        });

        logger.info('MongoDB connected successfully', {
            host: mongoose.connection.host,
            database: mongoose.connection.name,
            poolSize: 100
        });

        // Stage 7: Setup pool monitoring
        setupPoolMonitoring();

        // Fix for duplicate key error on devices.deviceId
        try {
            const usersCollection = mongoose.connection.collection('users');
            const indexes = await usersCollection.indexes();
            const indexName = 'devices.deviceId_1';
            const indexExists = indexes.some(index => index.name === indexName);

            if (indexExists) {
                await usersCollection.dropIndex(indexName);
                logger.info(`Dropped legacy unique index: ${indexName}`);
            }
        } catch (indexError: any) {
            logger.warn(`Attempted to drop index devices.deviceId_1 but failed: ${indexError.message}`);
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
        process.exit(1);
    }
};

// Stage 7: Pool monitoring
function setupPoolMonitoring() {
    const client = mongoose.connection.getClient();

    // Monitor connection pool events
    client.on('connectionPoolCreated', () => {
        logger.info('Connection pool created');
    });

    client.on('connectionCreated', () => {
        updatePoolMetrics();
    });

    client.on('connectionClosed', () => {
        updatePoolMetrics();
    });

    // Update metrics every 10 seconds
    setInterval(updatePoolMetrics, 10000);
}

function updatePoolMetrics() {
    try {
        const client = mongoose.connection.getClient();
        const pool = (client as any).topology?.s?.pool;

        if (pool && metrics.dbConnectionPoolSize) {
            metrics.dbConnectionPoolSize.set({ state: 'active' }, pool.totalConnectionCount || 0);
            metrics.dbConnectionPoolSize.set({ state: 'idle' }, pool.availableConnectionCount || 0);
        }
    } catch (error: any) {
        logger.debug(`Failed to update pool metrics: ${error.message}`);
    }
}

// Stage 7: Query Performance Monitoring Plugin
mongoose.plugin((schema) => {
    schema.pre(/^find/, function () {
        (this as any)._startTime = Date.now();
    });

    schema.post(/^find/, function (result) {
        const duration = (Date.now() - (this as any)._startTime) / 1000;
        const collection = (this as any).mongooseCollection?.name || 'unknown';

        if (metrics.dbQueryDuration) {
            metrics.dbQueryDuration.observe({ operation: 'find', collection }, duration);
        }
        if (metrics.dbOperationsTotal) {
            metrics.dbOperationsTotal.inc({ operation: 'find', collection, status: 'success' });
        }

        if (duration > 1) {
            logger.warn(`Slow query detected`, {
                collection,
                duration,
                query: (this as any).getQuery()
            });
        }
    });

    schema.post(/^find/, function (error: any) {
        if (error && metrics.dbOperationsTotal) {
            const collection = (this as any).mongooseCollection?.name || 'unknown';
            metrics.dbOperationsTotal.inc({ operation: 'find', collection, status: 'error' });
        }
    });
});

// Stage 2: Wrapper for MongoDB operations
export async function withMongoCircuitBreaker<T>(
    operation: () => Promise<T>
): Promise<T> {
    return mongoCircuitBreaker.execute(operation);
}

export async function disconnectDatabase(): Promise<void> {
    await mongoose.connection.close();
    logger.info('MongoDB disconnected');
}

export default connectDB;

