// src/core/monitoring/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { createContextualLogger } from '../logger/logger.js';

const logger = createContextualLogger({ module: 'Tracing' });

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

const sdk = new NodeSDK({
  serviceName: 'gnani-backend',
  traceExporter: jaegerExporter,
  metricReader: prometheusExporter,
  instrumentations: [getNodeAutoInstrumentations()]
});

export function startTracing() {
  try {
    sdk.start();
    logger.info('OpenTelemetry tracing started');
  } catch (error: any) {
    logger.error('Failed to start OpenTelemetry', { error: error.message });
  }
}

export function stopTracing() {
  return sdk.shutdown();
}
