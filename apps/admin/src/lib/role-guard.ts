/**
 * Role-gate stub for the platform admin console (issue #12).
 *
 * M1 RBAC (#28) will evaluate the real session token; today we gate on
 * explicit role lists. The decision shape matches #28's requirePerm.
 */
export type AdminRoleDecision = { action: 'allow' } | { action: 'redirect'; to: string };

export function evaluateAdminRole(pathname: string, roles: string[] | undefined): AdminRoleDecision {
  if (!roles || roles.length === 0) {
    return { action: 'redirect', to: '/login?next=' + encodeURIComponent(pathname) };
  }
  if (!roles.includes('staff') && !roles.includes('admin')) {
    return { action: 'redirect', to: '/account' };
  }
  return { action: 'allow' };
}
