import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

/**
 * Domain error with an API envelope code. Handled by the global error
 * handler and serialized per the contracts ErrorResponse shape.
 */
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    /** Serialize an ApiError per the contracts envelope. */
    sendApiError: (reply: FastifyReply, request: FastifyRequest, err: ApiError) => void;
  }
}

/**
 * Global error handler: maps ApiError (and known plugin errors) into the
 * API error envelope from packages/contracts. Anything unknown falls back
 * to Fastify's default handler (which logs + 500s).
 */
export const errorHandlerPlugin = fp(
  async (app: FastifyInstance): Promise<void> => {
    app.decorate('sendApiError', (reply: FastifyReply, request: FastifyRequest, err: ApiError) => {
      void reply.code(err.statusCode).send({
        error: {
          code: err.code,
          message: err.message,
          requestId: request.correlationId,
          details: err.details,
        },
      });
    });

    // 404/405 — unknown routes use the envelope (request-id correlated).
    // Track registered paths via onRoute (findRoute misbehaves inside the
    // not-found handler). Parametric paths match their literal template.
    const knownPaths = new Set<string>();
    app.addHook('onRoute', (routeOptions) => {
      knownPaths.add(routeOptions.url);
    });

    app.setNotFoundHandler((request, reply) => {
      const url = request.url.split('?')[0] ?? request.url;
      if (knownPaths.has(url)) {
        return reply.code(405).send({
          error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${request.method} not allowed for ${url}`, requestId: request.correlationId },
        });
      }
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: `Route ${request.method}:${request.url} not found`, requestId: request.correlationId },
      });
    });

    app.setErrorHandler((error, request, reply) => {
      if (error instanceof ApiError) {
        return app.sendApiError(reply, request, error);
      }
      const err = error as Error & { statusCode?: number };
      if (err.statusCode === 404) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: err.message, requestId: request.correlationId },
        });
      }
      if (err.statusCode === 405) {
        return reply.code(405).send({
          error: { code: 'METHOD_NOT_ALLOWED', message: err.message, requestId: request.correlationId },
        });
      }
      if (err.statusCode === 429) {
        return reply.code(429).send({
          error: { code: 'RATE_LIMITED', message: 'Too many requests — try again later', requestId: request.correlationId },
        });
      }
      if (err instanceof Error && err.message.includes('CORS')) {
        return reply.code(403).send({
          error: { code: 'CORS_DENIED', message: 'Origin not allowed by CORS policy', requestId: request.correlationId },
        });
      }
      return reply.send(error);
    });
  },
  { name: 'agora-error-handler' },
);
