import { describe, expect, it } from 'vitest';
import { evaluateDashboardRole } from '../src/lib/role-guard';

describe('evaluateDashboardRole (M0 stub)', () => {
  it('allows sellers', () => {
    expect(evaluateDashboardRole('/products', ['buyer', 'seller'])).toEqual({ action: 'allow' });
  });

  it('allows admins', () => {
    expect(evaluateDashboardRole('/payouts', ['admin'])).toEqual({ action: 'allow' });
  });

  it('redirects anonymous users to login', () => {
    const d = evaluateDashboardRole('/orders', undefined);
    expect(d).toMatchObject({ action: 'redirect' });
    if (d.action === 'redirect') expect(d.to).toContain('/login?next=');
  });

  it('redirects buyers (no seller role) away', () => {
    expect(evaluateDashboardRole('/orders', ['buyer'])).toMatchObject({ action: 'redirect', to: '/account' });
  });
});
