import { describe, expect, it } from 'vitest';
import {
  authLoginRequest,
  authRegisterRequest,
  errorEnvelope,
  healthResponse,
  readyResponse,
} from '../src/index.js';

describe('contract schemas', () => {
  it('validates a health response', () => {
    const ok = healthResponse.safeParse({
      status: 'ok',
      service: 'agora-api',
      uptimeSeconds: 12,
      timestamp: '2026-08-16T12:00:00.000Z',
    });
    expect(ok.success).toBe(true);
  });

  it('rejects a health response with a non-ok status', () => {
    const bad = healthResponse.safeParse({ status: 'degraded', service: 'x', uptimeSeconds: 1, timestamp: 't' });
    expect(bad.success).toBe(false);
  });

  it('parses a ready response with checks', () => {
    const ok = readyResponse.safeParse({
      status: 'ready',
      checks: [{ name: 'postgres', ok: true }],
    });
    expect(ok.success).toBe(true);
    const notReady = readyResponse.safeParse({
      status: 'not_ready',
      checks: [{ name: 'postgres', ok: false, detail: 'refused' }],
    });
    expect(notReady.success).toBe(true);
  });

  it('validates register input and enforces password rules', () => {
    const ok = authRegisterRequest.safeParse({ email: 'Seller@Example.COM', password: 'correct-horse' });
    expect(ok.success).toBe(true);

    const short = authRegisterRequest.safeParse({ email: 'a@b.co', password: 'short' });
    expect(short.success).toBe(false);

    const badEmail = authRegisterRequest.safeParse({ email: 'nope', password: 'long-enough-pass' });
    expect(badEmail.success).toBe(false);
  });

  it('validates login input including optional MFA code', () => {
    const ok = authLoginRequest.safeParse({ email: 'a@b.co', password: 'x'.repeat(8) });
    expect(ok.success).toBe(true);
    const withMfa = authLoginRequest.safeParse({ email: 'a@b.co', password: 'x'.repeat(8), mfaCode: '123456' });
    expect(withMfa.success).toBe(true);
    const badMfa = authLoginRequest.safeParse({ email: 'a@b.co', password: 'x'.repeat(8), mfaCode: '12' });
    expect(badMfa.success).toBe(false);
  });

  it('shapes the standard error envelope', () => {
    const ok = errorEnvelope.safeParse({
      error: { code: 'EMAIL_TAKEN', message: 'Email is already registered', requestId: 'abc' },
    });
    expect(ok.success).toBe(true);
  });
});
