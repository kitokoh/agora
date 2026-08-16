import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';

export interface SecurityOptions {
  /** Comma-separated allowlist of origins (CORS). Empty = same-origin only. */
  corsOrigins: string[];
  /** Global rate limit per IP (requests / window). */
  globalRateLimit: { max: number; timeWindowMs: number };
}

/**
 * Security baseline plugin (issue #18):
 *   - Helmet security headers (CSP, nosniff, frame options, HSTS)
 *   - CORS allowlist from configuration
 *   - Global per-IP rate limit (in-memory; Redis-backed auth limits land
 *     with the identity module, issue #24)
 */
export const securityPlugin = fp(
  async (app: FastifyInstance, options: SecurityOptions): Promise<void> => {
    await app.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          scriptSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false, // COEP blocks third-party embeds; revisit per module
    });

    await app.register(cors, {
      origin: (origin, callback) => {
        // No Origin header (curl, server-to-server) → allow.
        if (!origin) return callback(null, true);
        if (options.corsOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Origin not allowed by CORS'), false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    });

    await app.register(rateLimit, {
      max: options.globalRateLimit.max,
      timeWindow: options.globalRateLimit.timeWindowMs,
    });

  },
  { name: 'agora-security' },);
