/**
 * Pure auth-guard evaluation for the buyer app's edge middleware (#55).
 *
 * Takes an *already verified* session (see packages/edge-auth) — this file
 * stays side-effect free so it is unit-testable without the Next runtime.
 */
import type { SessionClaims } from '@agora/edge-auth';

export type AuthDecision = { action: 'allow' } | { action: 'redirect'; to: string };

const PUBLIC_ONLY_PREFIXES = ['/login', '/register'] as const;
const PROTECTED_PREFIXES = ['/account'] as const;

/** session === null → unauthenticated. */
export function evaluateAuthGuard(pathname: string, session: SessionClaims | null): AuthDecision {
  const onPublicOnly = PUBLIC_ONLY_PREFIXES.some((p) => pathname.startsWith(p));
  const onProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (onPublicOnly && session) {
    return { action: 'redirect', to: '/account' };
  }
  if (onProtected && !session) {
    return { action: 'redirect', to: `/login?next=${encodeURIComponent(pathname)}` };
  }
  return { action: 'allow' };
}
