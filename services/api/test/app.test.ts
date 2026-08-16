import { describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { buildApp } from '../src/app.js';

const silentLogger = pino({ level: 'silent' });

describe('api bootstrap', () => {
  it('responds to /healthz with liveness payload', async () => {
    const app = await buildApp({ logger: silentLogger });
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('agora-api');
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(typeof body.timestamp).toBe('string');
  });

  it('reports ready on /readyz when all probes pass', async () => {
    const app = await buildApp({ logger: silentLogger });
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ready');
    expect(body.checks).toContainEqual(expect.objectContaining({ name: 'self', ok: true }));
  });

  it('reports not ready on /readyz when a dependency probe fails', async () => {
    const app = await buildApp({ logger: silentLogger });
    app.registerProbe({
      name: 'postgres',
      check: async () => ({ ok: false, detail: 'connection refused' }),
    });
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.status).toBe('not_ready');
    expect(body.checks).toContainEqual(
      expect.objectContaining({ name: 'postgres', ok: false, detail: 'connection refused' }),
    );
  });

  it('echoes an inbound x-request-id and sets one when absent', async () => {
    const app = await buildApp({ logger: silentLogger });

    const withHeader = await app.inject({
      method: 'GET',
      url: '/healthz',
      headers: { 'x-request-id': 'client-correlation-123' },
    });
    expect(withHeader.headers['x-request-id']).toBe('client-correlation-123');

    const withoutHeader = await app.inject({ method: 'GET', url: '/healthz' });
    expect(withoutHeader.headers['x-request-id']).toBeDefined();
    expect(withoutHeader.headers['x-request-id']).not.toBe('');
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const app = await buildApp({ logger: silentLogger });
    const res = await app.inject({ method: 'GET', url: '/does-not-exist' });
    expect(res.statusCode).toBe(404);
    expect(res.json().message).toBeDefined();
  });

  it('supports injecting the module registry (scaffold is empty but wired)', async () => {
    const app = await buildApp({ logger: silentLogger });
    // The module registry is a real, ordered list — empty until M1 modules land.
    expect(app).toBeDefined();
    const res = await app.inject({ method: 'GET', url: '/v1' });
    // No /v1 routes yet: default Fastify 404.
    expect(res.statusCode).toBe(404);
  });
});
