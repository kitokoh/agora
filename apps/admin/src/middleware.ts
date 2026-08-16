import { NextResponse, type NextRequest } from 'next/server';
import { evaluateAdminRole } from '@/lib/role-guard';

/**
 * Admin middleware — role gate stub. Same permissive posture as the
 * dashboard (no real session until #28).
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('x-agora-app', 'admin');

  // TODO(#28): parse the session cookie and pass real roles.
  const roles = undefined as string[] | undefined;
  const decision = evaluateAdminRole(request.nextUrl.pathname, roles);
  if (decision.action === 'redirect') {
    return NextResponse.redirect(new URL(decision.to, request.url));
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next|_vercel|favicon|.*\\..*).*)'],
};
