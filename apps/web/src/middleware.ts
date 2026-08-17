import { NextResponse, type NextRequest } from 'next/server';
import { verifySessionToken } from '@agora/edge-auth';
import { evaluateAuthGuard } from '@/lib/auth-guard';

/** API base URL for middleware-side verification (server env). */
const API_URL = process.env.AGORA_API_URL ?? 'http://localhost:4000';

/**
 * Buyer app edge guard (#55): verifies the HttpOnly `agora_session` cookie
 * against the API JWKS and applies the auth decision:
 *   - /account/* requires a valid session → else /login?next=…
 *   - /login, /register bounce verified users to /account
 *
 * Fail-closed: any network error reaching the JWKS treats the session as
 * invalid (redirect to login) — never the reverse.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('x-agora-edge', 'true');

  const token = request.cookies.get('agora_session')?.value;
  const result = await verifySessionToken(token, {
    jwksUrl: `${API_URL}/.well-known/jwks.json`,
  });

  const session = result.ok ? result.claims : null;
  const decision = evaluateAuthGuard(request.nextUrl.pathname, session);
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
