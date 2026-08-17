/**
 * @agora/edge-auth — server-side session verification for frontend edge
 * middleware (issue #55).
 *
 * Validates Agora RS256 access tokens against the API's JWKS without any
 * Node-only APIs, so it runs on Next.js edge middleware:
 *   - `createRemoteJWKSet` resolves keys over fetch (edge-safe)
 *   - the resolved key set is cached in-memory per process
 *
 * Fail-closed: a missing/invalid/tampered token yields a `bad` result, never
 * throws for auth failures. Network errors also yield `bad` (redirect to
 * login); unexpected failures reach the optional `onError` hook.
 */
import {
  createLocalJWKSet,
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose';

/** Claims Agora puts in the access token (mirrors the API's AccessTokenClaims). */
export interface SessionClaims {
  /** User id. */
  sub: string;
  /** Verified email. */
  email: string;
  /** RBAC roles (e.g. ['buyer'], ['seller'], ['admin']). */
  roles: string[];
  /** Shop ids the user administers (seller). */
  shopIds: string[];
  /** Server-side session row id (family member). */
  sessionId: string;
  /** Issuer (must equal 'agora-api'). */
  iss: string;
  /** Audience (must equal 'agora-clients'). */
  aud: string;
  /** Expiration (epoch seconds). */
  exp: number;
  iat?: number;
}

export interface VerifySessionOptions {
  /** JWKS endpoint URL, e.g. https://api.example.com/.well-known/jwks.json */
  jwksUrl?: string;
  /** Static JWKS (tests/injection). Takes precedence over jwksUrl. */
  jwks?: Parameters<typeof createLocalJWKSet>[0];
  /** Optional error sink (e.g. logger.warn). Unexpected failures only. */
  onError?: (err: unknown) => void;
}

const ISSUER = 'agora-api';
const AUDIENCE = 'agora-clients';

export interface VerifyOk {
  ok: true;
  claims: SessionClaims;
}
export interface VerifyBad {
  ok: false;
  reason: 'missing' | 'invalid' | 'expired';
}
export type VerifySessionResult = VerifyOk | VerifyBad;

/**
 * Verify a session cookie value (the access token). Pass `jwks` to test
 * without networking; otherwise `jwksUrl` is fetched lazily and cached.
 */
export async function verifySessionToken(
  token: string | undefined | null,
  options: VerifySessionOptions,
): Promise<VerifySessionResult> {
  if (!token) return { ok: false, reason: 'missing' };

  const getKey: JWTVerifyGetKey = options.jwks
    ? createLocalJWKSet(options.jwks)
    : createRemoteJWKSet(new URL(options.jwksUrl ?? 'http://localhost:4000/.well-known/jwks.json'));

  try {
    const { payload } = await jwtVerify(token, getKey, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const claims = claimsFromPayload(payload);
    if (!claims) return { ok: false, reason: 'invalid' };
    return { ok: true, claims };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'ERR_JWT_EXPIRED') return { ok: false, reason: 'expired' };
    if (code === 'ERR_JWS_INVALID' || code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
      return { ok: false, reason: 'invalid' };
    }
    options.onError?.(err);
    return { ok: false, reason: 'invalid' };
  }
}

/** Narrow the generic JWT payload to the claims Agora guarantees. */
function claimsFromPayload(payload: JWTPayload): SessionClaims | null {
  if (typeof payload.sub !== 'string') return null;
  if (typeof payload.email !== 'string') return null;
  if (!Array.isArray(payload.roles) || !payload.roles.every((r) => typeof r === 'string')) return null;
  if (!Array.isArray(payload.shopIds) || !payload.shopIds.every((s) => typeof s === 'string')) return null;
  if (typeof payload.sessionId !== 'string') return null;
  if (typeof payload.exp !== 'number') return null;
  return {
    sub: payload.sub,
    email: payload.email,
    roles: payload.roles as string[],
    shopIds: payload.shopIds as string[],
    sessionId: payload.sessionId,
    iss: typeof payload.iss === 'string' ? payload.iss : '',
    aud: typeof payload.aud === 'string' ? payload.aud : '',
    exp: payload.exp,
    iat: typeof payload.iat === 'number' ? payload.iat : undefined,
  };
}
