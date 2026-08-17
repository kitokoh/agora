import { NextResponse, type NextRequest } from 'next/server';
import { verifySessionToken } from '@agora/edge-auth';
import { evaluateAdminRole } from '@/lib/role-guard';

/** API base URL for middleware-side verification (server env). */
const API_URL = process.env.AGORA_API_URL ?? 'http://localhost:4000';

/**
 * Admin back-office edge guard (#55): verifies the HttpOnly session cookie
 * and requires the `admin` role. Fail-closed.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('x-agora-app', 'admin');

  const token = request.cookies.get('agora_session')?.value;
  const result = await verifySessionToken(token, {
    jwksUrl: `${API_URL}/.well-known/jwks.json`,
  });
  const session = result.ok ? result.claims : null;

  const decision = evaluateAdminRole(request.nextUrl.pathname, session);
  if (decision.action === 'redirect') {
    return NextResponse.redirect(new URL(decision.to, request.url));
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next|_vercel|favicon|.*\\..*).*)'],
};
