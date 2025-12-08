// src/core/tracing/tracer.ts
// Stage 5: Enhanced OpenTelemetry tracing with Jaeger exporter
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Resource } = require('@opentelemetry/resources');
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { createContextualLogger } from '../logger/logger.js';

const logger = createContextualLogger({ module: 'Tracer' });

// Stage 5: Initialize OpenTelemetry SDK with Jaeger exporter
const sdk = new NodeSDK({
    resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'gnani-backend',
        [SemanticResourceAttributes.SERVICE_VERSION]: process.env.APP_VERSION || '1.0.0',
    }),
    // Stage 5: Jaeger exporter for distributed tracing
    traceExporter: new JaegerExporter({
        endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
    }),
    instrumentations: [
        getNodeAutoInstrumentations({
            // Disable file system instrumentation to reduce overhead
            '@opentelemetry/instrumentation-fs': { enabled: false }
        })
    ],
});

export const startTracing = () => {
    try {
        sdk.start();
        logger.info('Distributed tracing initialized successfully with Jaeger exporter.');
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
