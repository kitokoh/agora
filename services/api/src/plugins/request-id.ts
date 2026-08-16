import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { randomUUID } from 'node:crypto';

declare module 'fastify' {
  interface FastifyRequest {
    /** Correlation id propagated to logs and downstream calls. */
    correlationId: string;
  }
}

/**
 * Request correlation plugin.
 *
 * - Reuses an inbound `x-request-id` header when present (distributed
 *   tracing), otherwise generates a UUID.
 * - Always echoes the id back on the `x-request-id` response header so
 *   clients and support can correlate.
 *
 * Registered via Fastify's `genReqId` (app.ts) so the id is present in
 * the access log from the first line.
 */
export const requestIdPlugin = fp(async (app: FastifyInstance): Promise<void> => {
  app.decorateRequest('correlationId', '');
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const inbound = request.headers['x-request-id'];
    const id =
      typeof inbound === 'string' && inbound.length > 0 && inbound.length <= 128
        ? inbound
        : randomUUID();
    request.correlationId = id;
    reply.header('x-request-id', id);
  });
});
