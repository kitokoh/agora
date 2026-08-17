/**
 * Role gate for the seller dashboard edge middleware (#55).
 *
 * Takes an *already verified* session (see packages/edge-auth). The
 * dashboard is seller-only: sellers and admins pass; everyone else is
 * sent to the buyer app's login.
 */
import type { SessionClaims } from '@agora/edge-auth';

export type DashboardRoleDecision = { action: 'allow' } | { action: 'redirect'; to: string };

export const DASHBOARD_LOGIN_URL =
  process.env.NEXT_PUBLIC_WEB_APP_URL ?? 'http://localhost:3000';

/** session === null → unauthenticated. */
export function evaluateDashboardRole(
  pathname: string,
  session: SessionClaims | null,
): DashboardRoleDecision {
  if (!session) {
    return {
      action: 'redirect',
      to: `${DASHBOARD_LOGIN_URL}/login?next=${encodeURIComponent(`/dashboard${pathname === '/' ? '' : pathname}`)}`,
    };
  }
  if (!session.roles.includes('seller') && !session.roles.includes('admin')) {
    return { action: 'redirect', to: `${DASHBOARD_LOGIN_URL}/account` };
  }
  return { action: 'allow' };
}
