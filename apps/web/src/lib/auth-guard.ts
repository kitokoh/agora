/**
 * Pure auth-guard evaluation for the middleware stub.
 * Kept side-effect free so it is unit-testable without the Next runtime.
 * Activated in M1 (#23) with real session validation.
 */
export type AuthDecision = { action: 'allow' } | { action: 'redirect'; to: string };

const PUBLIC_ONLY_PREFIXES = ['/login', '/register'] as const;
const PROTECTED_PREFIXES = ['/account'] as const;

export function evaluateAuthGuard(pathname: string, hasSession: boolean): AuthDecision {
  const onPublicOnly = PUBLIC_ONLY_PREFIXES.some((p) => pathname.startsWith(p));
  const onProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (onPublicOnly && hasSession) {
    return { action: 'redirect', to: '/account' };
  }
  if (onProtected && !hasSession) {
    return { action: 'redirect', to: `/login?next=${encodeURIComponent(pathname)}` };
  }
  return { action: 'allow' };
}
