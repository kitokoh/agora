import { NextResponse, type NextRequest } from 'next/server';
import { evaluateAuthGuard } from '@/lib/auth-guard';

/**
 * Auth middleware stub (M0, issue #11).
 *
 * Guards are activated in M1 when the session service lands (#23) — the
 * decision logic lives in `lib/auth-guard.ts` and is unit-tested; this
 * file only applies it to the request.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('x-agora-edge', 'true');

  const decision = evaluateAuthGuard(request.nextUrl.pathname, request.cookies.has('agora_session'));
  if (decision.action === 'redirect') {
    const url = request.nextUrl.clone();
    url.pathname = new URL(decision.to, 'http://local').pathname;
    url.search = new URL(decision.to, 'http://local').search;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/login', '/register', '/account/:path*'],
};
