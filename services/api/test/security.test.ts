import { describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

const silentLogger = pino({ level: 'silent' });

function testConfig(overrides: Record<string, string> = {}) {
  return loadConfig({ NODE_ENV: 'test', RATE_LIMIT_MAX: '1000', ...overrides });
}

describe('security baseline (issue #18)', () => {
  it('sends helmet security headers on every response', async () => {
    const app = await buildApp({ logger: silentLogger, config: testConfig() });
    const res = await app.inject({ method: 'GET', url: '/healthz' });

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['referrer-policy']).toBeDefined();
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
  });

  it('allows configured CORS origins', async () => {
    const app = await buildApp({
      logger: silentLogger,
      config: testConfig({ CORS_ORIGINS: 'http://localhost:3000' }),
    });
    const res = await app.inject({
      method: 'GET',
      url: '/healthz',
      headers: { origin: 'http://localhost:3000' },
    });
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('rejects unlisted CORS origins', async () => {
    const app = await buildApp({
      logger: silentLogger,
      config: testConfig({ CORS_ORIGINS: 'http://localhost:3000' }),
    });
    const res = await app.inject({
      method: 'GET',
      url: '/healthz',
      headers: { origin: 'https://evil.example' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('enforces the global per-IP rate limit with the error envelope', async () => {
    const app = await buildApp({
      logger: silentLogger,
      config: testConfig({ RATE_LIMIT_MAX: '3' }),
    });

    for (let i = 0; i < 3; i += 1) {
      const res = await app.inject({ method: 'GET', url: '/healthz' });
      expect(res.statusCode).toBe(200);
    }

    const limited = await app.inject({ method: 'GET', url: '/healthz' });
    expect(limited.statusCode).toBe(429);
    const body = limited.json();
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(body.error.requestId).toBeDefined();
    expect(limited.headers['retry-after']).toBeDefined();
  });
});
