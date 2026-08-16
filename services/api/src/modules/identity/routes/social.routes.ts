import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { type SocialService, type SocialProvider } from '../social.service.js';
import type { SessionService } from '../sessions.service.js';
import type { AuditService } from '../audit.service.js';
import { ApiError } from '../../../plugins/error-handler.js';
import { parseBody } from './validate.js';

const callbackRequest = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

export interface SocialRoutesDeps {
  social: SocialService;
  sessions: SessionService;
  audit: AuditService;
}

const PROVIDERS: SocialProvider[] = ['google', 'facebook', 'apple'];

/**
 * OIDC social login routes (issue #27). In-memory state store: the
 * authorize step returns `state` + `nonce`; the callback consumes them.
 */
export async function socialRoutes(app: FastifyInstance, deps: SocialRoutesDeps): Promise<void> {
  const { social, sessions, audit } = deps;
  // state -> nonce (short-lived; CSRF protection)
  const pendingStates = new Map<string, { nonce: string; at: number }>();

  app.get('/v1/auth/oauth/:provider', { config: { rateLimit: { max: 30, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const provider = request.params as { provider: string };
    if (!PROVIDERS.includes(provider.provider as SocialProvider)) {
      throw new ApiError(404, 'SOCIAL_PROVIDER_UNKNOWN', 'Unknown OAuth provider');
    }
    const state = crypto.randomUUID();
    const { url, nonce } = await social.authorizeUrl(provider.provider as SocialProvider, state);
    pendingStates.set(state, { nonce, at: Date.now() });
    return reply.redirect(url);
  });

  app.post('/v1/auth/oauth/:provider/callback', { config: { rateLimit: { max: 30, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const { provider: providerParam } = request.params as { provider: string };
    const provider = providerParam as SocialProvider;
    if (!PROVIDERS.includes(provider)) {
      throw new ApiError(404, 'SOCIAL_PROVIDER_UNKNOWN', 'Unknown OAuth provider');
    }
    const { code, state } = parseBody(callbackRequest, request.body);

    const pending = pendingStates.get(state);
    if (!pending || Date.now() - pending.at > 10 * 60 * 1000) {
      throw new ApiError(400, 'SOCIAL_STATE_INVALID', 'OAuth state is invalid or expired');
    }
    pendingStates.delete(state);

    const socialUser = await social.exchangeCode(provider, code, pending.nonce);
    const user = await social.findOrCreate(socialUser);

    const roles = await sessions.loadRoles(user.id);
    const shopIds = await sessions.loadShopIds(user.id);
    const result = await sessions.issueTokens(user.id, user.email, roles, shopIds, {
      ip: request.ip,
      ua: typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : undefined,
    });

    await audit.record(
      { actorType: 'user', actorId: user.id, ip: request.ip, ua: request.headers['user-agent'] },
      'auth.social_login',
      'user',
      user.id,
      { provider },
    );
    return reply.code(200).send(result);
  });
}
