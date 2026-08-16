import { NextResponse, type NextRequest } from 'next/server';
import { evaluateDashboardRole } from '@/lib/role-guard';

/**
 * Dashboard middleware — role gate stub. Reads the (future) session
 * cookie's roles; until #28 lands there is no signed session, so this
 * stays permissive: it only redirects when roles are *explicitly* known
 * to be insufficient.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('x-agora-app', 'dashboard');

  // TODO(#28): parse the session cookie and pass real roles.
  const roles = undefined as string[] | undefined;
  const decision = evaluateDashboardRole(request.nextUrl.pathname, roles);
  if (decision.action === 'redirect') {
    return NextResponse.redirect(new URL(decision.to, request.url));
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next|_vercel|favicon|.*\\..*).*)'],
};
