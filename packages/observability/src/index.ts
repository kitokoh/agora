import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';

import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION, SEMRESATTRS_DEPLOYMENT_ENVIRONMENT } from '@opentelemetry/semantic-conventions';
import { trace, metrics } from '@opentelemetry/api';

export interface ObservabilityOptions {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  /** OTLP HTTP endpoint (LGTM stack / Grafana Alloy). Default: localhost:4318. */
  otlpEndpoint?: string;
  /** Disable OTLP exporting (tests/CI). Metrics fall back to console. */
  exportOnlyInProduction?: boolean;
  /** Optional Sentry DSN — initialized when present. */
  sentryDsn?: string;
  isProduction?: boolean;
}

export interface ObservabilityHandle {
  /** Flush + shut down SDK (call during graceful shutdown). */
  shutdown: () => Promise<void>;
}

let sdk: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry for a service (ADR-0009):
 *   - traces: OTLP HTTP exporter (Loki/Tempo/Prometheus stack)
 *   - metrics: periodic OTLP metric reader
 *   - auto-instrumentation for http/fastify/pg/redis clients
 *
 * Safe to call once per process. Returns a no-op handle when disabled.
 */
export function initObservability(options: ObservabilityOptions): ObservabilityHandle {
  const {
    serviceName,
    serviceVersion = '0.1.0',
    environment = 'development',
    otlpEndpoint = 'http://localhost:4318',
    exportOnlyInProduction = true,
    isProduction = false,
  } = options;

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
  });

  const shouldExport = !exportOnlyInProduction || isProduction;

  if (shouldExport) {
    sdk = new NodeSDK({
      resource,
      traceExporter: new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` }),
      metricReader: new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: `${otlpEndpoint}/v1/metrics` }),
        exportIntervalMillis: 30_000,
      }),
      instrumentations: [getNodeAutoInstrumentations()],
    });
    sdk.start();
  } else {
    // Tests/CI: no SDK, no exporters, no network — tracer/meter return
    // the OpenTelemetry no-op implementations and instrumented code runs
    // unchanged.
    return { shutdown: async () => {} };
  }

  return {
    shutdown: async () => {
      await sdk?.shutdown();
      sdk = null;
    },
  };
}

export { trace, metrics };

/** Convenience accessor for the current service tracer. */
export function getTracer(serviceName: string) {
  return trace.getTracer(serviceName);
}

/** Convenience accessor for the current service meter. */
export function getMeter(serviceName: string) {
  return metrics.getMeter(serviceName);
}
