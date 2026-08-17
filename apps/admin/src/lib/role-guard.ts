/**
 * Role gate for the admin back-office edge middleware (#55).
 *
 * Takes an *already verified* session (see packages/edge-auth). Admin-only:
 * requires the `admin` role; everyone else is sent to the buyer app's login
 * (admins log in through the same identity surface).
 */
import type { SessionClaims } from '@agora/edge-auth';

export type AdminRoleDecision = { action: 'allow' } | { action: 'redirect'; to: string };

export const ADMIN_LOGIN_URL = process.env.NEXT_PUBLIC_WEB_APP_URL ?? 'http://localhost:3000';

/** session === null → unauthenticated. */
export function evaluateAdminRole(
  pathname: string,
  session: SessionClaims | null,
): AdminRoleDecision {
  if (!session) {
    return {
      action: 'redirect',
      to: `${ADMIN_LOGIN_URL}/login?next=${encodeURIComponent(`/admin${pathname === '/' ? '' : pathname}`)}`,
    };
  }
  if (!session.roles.includes('admin')) {
    return { action: 'redirect', to: `${ADMIN_LOGIN_URL}/account` };
  }
  return { action: 'allow' };
}
