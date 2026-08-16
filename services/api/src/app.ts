import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { Logger } from 'pino';
import { requestIdPlugin } from './plugins/request-id.js';
import { healthPlugin } from './plugins/health.js';
import { securityPlugin } from './plugins/security.js';
import { registerModules } from './modules/index.js';
import type { AppConfig } from './config.js';

export interface BuildAppOptions {
  logger: Logger;
  config: AppConfig;
  /** Overrides for tests: disable the request logger, custom body limit, etc. */
  serverOptions?: Partial<FastifyServerOptions>;
}

/**
 * Build the Fastify application without starting the network listener.
 *
 * Kept as a pure factory so integration tests can `app.inject()` without
 * binding a port (see test/app.test.ts).
 */
export async function buildApp({
  logger,
  config,
  serverOptions,
}: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    loggerInstance: logger,
    trustProxy: true,
    genReqId: (request) => {
      // Reuse an inbound x-request-id for distributed correlation; this
      // value is also echoed on the response (request-id plugin).
      const inbound = request.headers['x-request-id'];
      if (typeof inbound === 'string' && inbound.length > 0 && inbound.length <= 128) {
        return inbound;
      }
      return randomUUID();
    },
    ...serverOptions,
  });

  await app.register(requestIdPlugin);
  await app.register(securityPlugin, {
    corsOrigins: config.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
    globalRateLimit: { max: config.RATE_LIMIT_MAX, timeWindowMs: 60_000 },
  });
  await app.register(healthPlugin);
  await registerModules(app);

  return app;
}
