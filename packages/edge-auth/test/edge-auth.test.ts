import { describe, expect, it } from 'vitest';
import { generateKeyPair, SignJWT, exportJWK, type KeyLike } from 'jose';
import { verifySessionToken, type SessionClaims } from '../src/index.js';

interface TestKeys {
  privateKey: KeyLike;
  jwks: { keys: Array<Record<string, unknown>> };
}

async function makeKeys(): Promise<TestKeys> {
  const pair = await generateKeyPair('RS256', { extractable: true });
  const jwk = await exportJWK(pair.publicKey);
  return {
    privateKey: pair.privateKey,
    jwks: { keys: [{ ...jwk, use: 'sig', alg: 'RS256', kid: 'agora-access-v1' }] },
  };
}

async function sign(
  keys: TestKeys,
  overrides: Partial<SessionClaims> = {},
  extra: Record<string, unknown> = {},
): Promise<string> {
  const base: SessionClaims = {
    sub: 'usr_1',
    email: 'buyer@example.com',
    roles: ['buyer'],
    shopIds: [],
    sessionId: 'sess_1',
    iss: 'agora-api',
    aud: 'agora-clients',
    exp: Math.floor(Date.now() / 1000) + 900,
    iat: Math.floor(Date.now() / 1000),
  };
  const claims = { ...base, ...overrides };
  return new SignJWT({ ...claims, ...extra })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setIssuer(claims.iss)
    .setAudience(claims.aud)
    .setExpirationTime(claims.exp)
    .sign(keys.privateKey);
}

describe('verifySessionToken', () => {
  it('accepts a valid token signed by the published key', async () => {
    const keys = await makeKeys();
    const token = await sign(keys);
    const result = await verifySessionToken(token, { jwks: keys.jwks });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.claims.sub).toBe('usr_1');
    expect(result.claims.roles).toEqual(['buyer']);
    expect(result.claims.shopIds).toEqual([]);
    expect(result.claims.sessionId).toBe('sess_1');
  });

  it('rejects missing tokens', async () => {
    const keys = await makeKeys();
    const result = await verifySessionToken(undefined, { jwks: keys.jwks });
    expect(result).toEqual({ ok: false, reason: 'missing' });
  });

  it('rejects tokens signed by a different key', async () => {
    const keys = await makeKeys();
    const other = await makeKeys();
    const token = await sign(other);
    const result = await verifySessionToken(token, { jwks: keys.jwks });
    expect(result.ok).toBe(false);
  });

  it('rejects tampered tokens', async () => {
    const keys = await makeKeys();
    const token = await sign(keys);
    const [header, _payload, signature] = token.split('.');
    const tampered = `${header}.${Buffer.from(
      JSON.stringify({ sub: 'usr_9' }),
    ).toString('base64url')}.${signature}`;
    const result = await verifySessionToken(tampered, { jwks: keys.jwks });
    expect(result.ok).toBe(false);
  });

  it('reports expired tokens distinctly', async () => {
    const keys = await makeKeys();
    const token = await sign(keys, { exp: Math.floor(Date.now() / 1000) - 60 });
    const result = await verifySessionToken(token, { jwks: keys.jwks });
    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects tokens with the wrong issuer/audience', async () => {
    const keys = await makeKeys();
    const token = await sign(keys, { iss: 'evil', aud: 'evil' });
    const result = await verifySessionToken(token, { jwks: keys.jwks });
    expect(result.ok).toBe(false);
  });

  it('rejects tokens missing required claims (no roles)', async () => {
    const keys = await makeKeys();
    const token = await sign(keys, {}, { roles: undefined });
    // Removing roles makes the payload fail the claims narrowing.
    const result = await verifySessionToken(token, { jwks: keys.jwks });
    expect(result.ok).toBe(false);
  });
});
