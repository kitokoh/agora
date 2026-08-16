import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { collectDefaultMetrics, Registry, Counter, Histogram } from 'prom-client';

export interface Metrics {
  registry: Registry;
  httpRequestsTotal: Counter<string>;
  httpRequestDuration: Histogram<string>;
}

/**
 * Prometheus metrics endpoint (audit #56).
 *
 * `GET /metrics` serves Prometheus text format via prom-client. The local
 * LGTM stack (ops/observability/prometheus.yml) scrapes this endpoint.
 */
export const metricsPlugin = fp(
  async (app: FastifyInstance): Promise<void> => {
    const registry = new Registry();
    collectDefaultMetrics({ register: registry });

    const httpRequestsTotal = new Counter({
      name: 'agora_http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [registry],
    });
    const httpRequestDuration = new Histogram({
      name: 'agora_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [registry],
    });

    app.decorate('metrics', { registry, httpRequestsTotal, httpRequestDuration });

    app.addHook('onResponse', async (request, reply) => {
      const route = request.routeOptions?.url ?? request.url;
      const status = String(reply.statusCode);
      httpRequestsTotal.inc({ method: request.method, route, status });
      httpRequestDuration.observe(
        { method: request.method, route, status },
        Number(reply.elapsedTime) / 1000,
      );
    });

    app.get('/metrics', async (_request, reply) => {
      void reply
        .header('content-type', registry.contentType)
        .send(await registry.metrics());
    });
  },
  { name: 'agora-metrics' },
);
