import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

export interface ReadinessProbe {
  name: string;
  /** Resolve with ok=false (and detail) when the dependency is unhealthy. */
  check: () => Promise<{ ok: boolean; detail?: string }>;
}

declare module 'fastify' {
  interface FastifyInstance {
    /** Register a readiness probe (e.g. postgres ping, redis ping). */
    registerProbe: (probe: ReadinessProbe) => void;
  }
}

/**
 * Health endpoints plugin.
 *
 * - `GET /healthz` — liveness. Always 200 while the process is up.
 * - `GET /readyz` — readiness. 200 only when every registered dependency
 *   probe passes; 503 with per-check details otherwise.
 *
 * Modules register probes at startup via `app.registerProbe(...)`; the
 * API boots with a built-in `self` probe so readiness is meaningful even
 * before external dependencies are wired (issues #13, #18).
 */
export const healthPlugin = fp(async (app: FastifyInstance): Promise<void> => {
  const probes = new Map<string, ReadinessProbe>();

  app.decorate('registerProbe', (probe: ReadinessProbe) => {
    probes.set(probe.name, probe);
  });

  app.registerProbe({
    name: 'self',
    check: async () => ({ ok: true }),
  });

  app.get('/healthz', async () => ({
    status: 'ok',
    service: 'agora-api',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  }));

  app.get('/readyz', async (_request, reply) => {
    const results = await Promise.all(
      [...probes.values()].map(async (probe) => {
        try {
          const outcome = await probe.check();
          return { name: probe.name, ok: outcome.ok, detail: outcome.detail };
        } catch (err) {
          return {
            name: probe.name,
            ok: false,
            detail: err instanceof Error ? err.message : 'unknown probe error',
          };
        }
      }),
    );

    const ready = results.every((r) => r.ok);
    reply.code(ready ? 200 : 503);
    return {
      status: ready ? 'ready' : 'not_ready',
      checks: results,
    };
  });
});
