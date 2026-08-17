import { describe, expect, it } from 'vitest';
import { evaluateAdminRole } from '../src/lib/role-guard';
import type { SessionClaims } from '@agora/edge-auth';

function session(roles: string[]): SessionClaims {
  return {
    sub: 'usr_1',
    email: 'u@example.com',
    roles,
    shopIds: [],
    sessionId: 'sess_1',
    iss: 'agora-api',
    aud: 'agora-clients',
    exp: 9999999999,
  };
}

describe('evaluateAdminRole (session-aware, #55)', () => {
  it('allows admins', () => {
    expect(evaluateAdminRole('/users', session(['admin']))).toEqual({ action: 'allow' });
  });

  it('redirects anonymous users to the buyer login', () => {
    const d = evaluateAdminRole('/users', null);
    expect(d).toMatchObject({ action: 'redirect' });
    if (d.action === 'redirect') expect(d.to).toContain('/login?next=');
  });

  it('redirects non-admins away', () => {
    const d = evaluateAdminRole('/users', session(['seller']));
    expect(d).toMatchObject({ action: 'redirect' });
    if (d.action === 'redirect') expect(d.to).toContain('/account');
  });
});
