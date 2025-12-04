// src/core/monitoring/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { createContextualLogger } from '../logger/logger.js';

const logger = createContextualLogger({ module: 'Tracing' });

let sdk: NodeSDK | null = null;

// Initialize SDK lazily to avoid startup crashes
function initializeSDK() {
  if (sdk) return sdk;
  
  try {
    const prometheusExporter = new PrometheusExporter(
      {
        port: 9464,
        endpoint: '/metrics'
      },
      () => {
        logger.info('Prometheus scrape endpoint: http://localhost:9464/metrics');
      }
    );

    const jaegerExporter = new JaegerExporter({
      endpoint: 'http://localhost:14268/api/traces'
    });

    sdk = new NodeSDK({
      serviceName: 'gnani-backend',
      traceExporter: jaegerExporter,
      metricReader: prometheusExporter,
      instrumentations: [getNodeAutoInstrumentations()]
    });
    
    return sdk;
  } catch (error: any) {
    logger.error('Failed to initialize OpenTelemetry SDK', { error: error.message });
    return null;
  }
}

export function startTracing() {
  try {
    const sdkInstance = initializeSDK();
    if (sdkInstance) {
      sdkInstance.start();
      logger.info('OpenTelemetry tracing started');
    } else {
      logger.warn('OpenTelemetry SDK not initialized, tracing disabled');
    }
  } catch (error: any) {
    logger.error('Failed to start OpenTelemetry', { error: error.message });
  }
}

export function stopTracing() {
  if (sdk) {
    return sdk.shutdown();
  }
  return Promise.resolve();
}
