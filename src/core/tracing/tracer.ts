// src/core/tracing/tracer.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Resource } = require('@opentelemetry/resources');
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { createContextualLogger } from '../logger/logger.js';

const logger = createContextualLogger({ module: 'Tracer' });

// Initialize OpenTelemetry SDK
const sdk = new NodeSDK({
    resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'gnani-backend',
        [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
    }),
    instrumentations: [getNodeAutoInstrumentations()],
});

export const startTracing = () => {
    try {
        sdk.start();
        logger.info('Distributed tracing initialized successfully.');
    } catch (error: any) {
        logger.error(`Failed to initialize distributed tracing: ${error.message}`);
    }
};

export const stopTracing = async () => {
    try {
        await sdk.shutdown();
        logger.info('Distributed tracing stopped.');
    } catch (error: any) {
        logger.error(`Error stopping distributed tracing: ${error.message}`);
    }
};

// Helper to generate correlation IDs for logging
import { v4 as uuidv4 } from 'uuid';

export function generateCorrelationId(): string {
    return uuidv4();
}
