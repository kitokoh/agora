import { describe, expect, it } from 'vitest';
import { evaluateAuthGuard } from '../src/lib/auth-guard';

describe('evaluateAuthGuard (M0 stub)', () => {
  it('allows public pages when signed out', () => {
    expect(evaluateAuthGuard('/browse', false)).toEqual({ action: 'allow' });
    expect(evaluateAuthGuard('/login', false)).toEqual({ action: 'allow' });
  });

  it('allows public pages when signed in', () => {
    expect(evaluateAuthGuard('/browse', true)).toEqual({ action: 'allow' });
  });

  it('redirects signed-out users away from protected pages', () => {
    const decision = evaluateAuthGuard('/account', false);
    expect(decision).toMatchObject({ action: 'redirect' });
    if (decision.action === 'redirect') expect(decision.to).toContain('/login?next=');
  });

  it('redirects signed-in users away from public-only pages', () => {
    expect(evaluateAuthGuard('/login', true)).toMatchObject({ action: 'redirect', to: '/account' });
    expect(evaluateAuthGuard('/register', true)).toMatchObject({ action: 'redirect', to: '/account' });
  });
});
