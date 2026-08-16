import { createConnection } from 'node:net';
import type { ReadinessProbe } from '../plugins/health.js';

/** Parse a redis:// URL into host/port for a raw TCP readiness ping. */
function parseRedisUrl(url: string): { host: string; port: number } {
  try {
    const parsed = new URL(url);
    return { host: parsed.hostname, port: Number(parsed.port || 6379) };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

/**
 * Readiness probe for Redis — raw TCP PING without pulling in a client
 * dependency at the bootstrap layer. The identity module (#24) swaps this
 * for a real ioredis-backed check once rate limiting lands.
 */
export function redisProbe(redisUrl: string): ReadinessProbe {
  return {
    name: 'redis',
    check: () =>
      new Promise((resolve) => {
        const { host, port } = parseRedisUrl(redisUrl);
        const socket = createConnection({ host, port, timeout: 1500 });
        const finish = (ok: boolean, detail?: string): void => {
          socket.destroy();
          resolve({ ok, detail });
        };
        socket.once('connect', () => finish(true));
        socket.once('timeout', () => finish(false, `connect timeout to ${host}:${port}`));
        socket.once('error', (err) => finish(false, err.message));
      }),
  };
}
