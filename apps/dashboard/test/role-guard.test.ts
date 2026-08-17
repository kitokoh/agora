import { describe, expect, it } from 'vitest';
import { evaluateDashboardRole } from '../src/lib/role-guard';
import type { SessionClaims } from '@agora/edge-auth';

function session(roles: string[]): SessionClaims {
  return {
    sub: 'usr_1',
    email: 'u@example.com',
    roles,
    shopIds: roles.includes('seller') ? ['shop_1'] : [],
    sessionId: 'sess_1',
    iss: 'agora-api',
    aud: 'agora-clients',
    exp: 9999999999,
  };
}

describe('evaluateDashboardRole (session-aware, #55)', () => {
  it('allows sellers', () => {
    expect(evaluateDashboardRole('/products', session(['buyer', 'seller']))).toEqual({ action: 'allow' });
  });

  it('allows admins', () => {
    expect(evaluateDashboardRole('/payouts', session(['admin']))).toEqual({ action: 'allow' });
  });

  it('redirects anonymous users to the buyer login', () => {
    const d = evaluateDashboardRole('/orders', null);
    expect(d).toMatchObject({ action: 'redirect' });
    if (d.action === 'redirect') expect(d.to).toContain('/login?next=');
  });

  it('redirects buyers (no seller role) away', () => {
    const d = evaluateDashboardRole('/orders', session(['buyer']));
    expect(d).toMatchObject({ action: 'redirect' });
    if (d.action === 'redirect') expect(d.to).toContain('/account');
  });
});
