import { describe, expect, it } from 'vitest';
import { evaluateAdminRole } from '../src/lib/role-guard';

describe('evaluateAdminRole (M0 stub)', () => {
  it('allows staff and admins', () => {
    expect(evaluateAdminRole('/shops', ['staff'])).toEqual({ action: 'allow' });
    expect(evaluateAdminRole('/finance', ['admin'])).toEqual({ action: 'allow' });
  });

  it('redirects anonymous users to login', () => {
    const d = evaluateAdminRole('/shops', undefined);
    expect(d).toMatchObject({ action: 'redirect' });
    if (d.action === 'redirect') expect(d.to).toContain('/login?next=');
  });

  it('redirects non-staff roles away', () => {
    expect(evaluateAdminRole('/audit', ['seller'])).toMatchObject({ action: 'redirect', to: '/account' });
  });
});
