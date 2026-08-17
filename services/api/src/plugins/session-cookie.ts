/**
 * Session cookie plugin (#55 — session-aware frontends).
 *
 * The access token is mirrored into an HttpOnly, SameSite=Lax cookie so the
 * Next.js apps' edge middleware can validate sessions server-side (no
 * JS-accessible token, no sessionStorage reliance). The bearer body field is
 * kept for SDK clients — nothing breaks for them.
 *
 * Cookie visibility: set by the API origin, readable by the apps when they
 * share a registrable domain (localhost:3000 ↔ localhost:4000 in dev; same
 * site in prod behind a shared domain/reverse proxy).
 */
import fp from 'fastify-plugin';
import fastifyCookie from '@fastify/cookie';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AppConfig } from '../config.js';

export interface SessionCookieOptions {
  config: AppConfig;
}

declare module 'fastify' {
  interface FastifyInstance {
    /** Mirror an access token into the HttpOnly session cookie. */
    setSessionCookie: (reply: FastifyReply, accessToken: string) => void;
    /** Expire + clear the session cookie. */
    clearSessionCookie: (reply: FastifyReply) => void;
    /** Name of the session cookie (default: agora_session). */
    sessionCookieName: string;
  }
}

export const sessionCookiePlugin = fp(
  async (app: FastifyInstance, options: SessionCookieOptions): Promise<void> => {
    const { config } = options;
    const name = config.SESSION_COOKIE_NAME ?? 'agora_session';

    await app.register(fastifyCookie);

    app.decorate('sessionCookieName', name);
    app.decorate('setSessionCookie', (reply: FastifyReply, accessToken: string) => {
      void reply.setCookie(name, accessToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.COOKIE_SECURE === true,
        path: '/',
        // Keep the cookie life aligned with the access-token TTL; browsers
        // that can't refresh simply bounce to /login (middleware rejects).
        maxAge: parseAccessTtlSeconds(config.JWT_ACCESS_TTL ?? '15m'),
      });
    });
    app.decorate('clearSessionCookie', (reply: FastifyReply) => {
      void reply.clearCookie(name, { path: '/' });
    });
  },
  { name: 'session-cookie' },
);

/** '15m' | '2h' | '1d' → seconds; defaults to 900s on malformed input. */
function parseAccessTtlSeconds(ttl: string): number {
  const parsed = /^(\d+)([smhd])$/.exec(ttl);
  if (!parsed) return 900;
  const unitSeconds: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  const unit = parsed[2] ?? 's';
  const amount = parsed[1] ?? '900';
  return Number(amount) * (unitSeconds[unit] ?? 1);
}
