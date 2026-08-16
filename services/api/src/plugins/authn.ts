import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { SessionService } from '../modules/identity/sessions.service.js';
import type { PermissionService } from '../modules/identity/permissions.service.js';
import { ApiError } from './error-handler.js';

export interface Actor {
  userId: string;
  email: string;
  roles: string[];
  shopIds: string[];
  sessionId: string;
  permissions: string[];
}

declare module 'fastify' {
  interface FastifyInstance {
    /** Verify the bearer token and attach the actor (authn). */
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<Actor>;
    /** Build a deny-by-default permission guard (authz). */
    requirePerm: (...required: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    actor?: Actor;
  }
}

export interface AuthnPluginOptions {
  sessions: SessionService;
  permissions: PermissionService;
}

/**
 * Authentication + authorization (ADR-0007, issue #28):
 *   - `authenticate` verifies the RS256 access token and loads permissions
 *   - `requirePerm(...)` is a deny-by-default route guard
 *
 * Routes opt in per-route (`preHandler: app.requirePerm('catalog:write')`);
 * everything is denied until explicitly allowed.
 */
export const authnPlugin = fp(
  async (app: FastifyInstance, options: AuthnPluginOptions): Promise<void> => {
    const { sessions, permissions } = options;

    app.decorate('authenticate', async (request: FastifyRequest, _reply: FastifyReply) => {
      const header = request.headers.authorization;
      if (!header?.startsWith('Bearer ')) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Missing bearer token');
      }
      const token = header.slice('Bearer '.length);
      const claims = await sessions.verifyAccessToken(token);

      const perms = await permissions.permissionsForRoles(claims.roles);
      const actor: Actor = {
        userId: claims.sub,
        email: claims.email,
        roles: claims.roles,
        shopIds: claims.shopIds,
        sessionId: claims.sessionId,
        permissions: perms,
      };
      return actor;
    });

    app.decorate('requirePerm', (...required: string[]) => {
      return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
        if (!request.actor) {
          throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
        }
        const missing = required.filter((permission) => !request.actor!.permissions.includes(permission));
        if (missing.length > 0) {
          throw new ApiError(
            403,
            'FORBIDDEN',
            `Missing permission(s): ${missing.join(', ')}`,
          );
        }
      };
    });

    // Attach the actor when a token is present (public routes still work
    // without one; requirePerm enforces protection per route).
    app.addHook('preHandler', async (request, reply) => {
      if (!request.headers.authorization) return;
      request.actor = await app.authenticate(request, reply);
    });
  },
  { name: 'agora-authn' },
);
