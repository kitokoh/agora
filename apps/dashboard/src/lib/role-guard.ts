/**
 * Role-gate stub for the seller dashboard (issue #12).
 *
 * M1 RBAC (#28) will evaluate the real session token; today we gate on a
 * development-only flag so the shell is testable end-to-end. The shape of
 * the decision matches what #28 will produce.
 */
export type DashboardRoleDecision = { action: 'allow' } | { action: 'redirect'; to: string };

export function evaluateDashboardRole(pathname: string, roles: string[] | undefined): DashboardRoleDecision {
  if (!roles || roles.length === 0) {
    return { action: 'redirect', to: '/login?next=' + encodeURIComponent(pathname) };
  }
  if (!roles.includes('seller') && !roles.includes('admin')) {
    return { action: 'redirect', to: '/account' };
  }
  return { action: 'allow' };
}
