import { describe, expect, it } from 'vitest';
import { evaluateAuthGuard } from '../src/lib/auth-guard';
import type { SessionClaims } from '@agora/edge-auth';

const session: SessionClaims = {
  sub: 'usr_1',
  email: 'buyer@example.com',
  roles: ['buyer'],
  shopIds: [],
  sessionId: 'sess_1',
  iss: 'agora-api',
  aud: 'agora-clients',
  exp: 9999999999,
};

describe('evaluateAuthGuard (session-aware, #55)', () => {
  it('allows public pages when signed out', () => {
    expect(evaluateAuthGuard('/browse', null)).toEqual({ action: 'allow' });
    expect(evaluateAuthGuard('/login', null)).toEqual({ action: 'allow' });
  });

  it('allows public pages when signed in', () => {
    expect(evaluateAuthGuard('/browse', session)).toEqual({ action: 'allow' });
  });

  it('redirects signed-out users away from protected pages', () => {
    const decision = evaluateAuthGuard('/account', null);
    expect(decision).toMatchObject({ action: 'redirect' });
    if (decision.action === 'redirect') expect(decision.to).toContain('/login?next=');
  });

  it('redirects signed-in users away from public-only pages', () => {
    expect(evaluateAuthGuard('/login', session)).toMatchObject({ action: 'redirect', to: '/account' });
    expect(evaluateAuthGuard('/register', session)).toMatchObject({ action: 'redirect', to: '/account' });
  });
});
