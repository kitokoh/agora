import type { FastifyInstance } from 'fastify';
import { Redis } from 'ioredis';
import type { AgoraModule } from '../index.js';
import { passwordService } from './password.service.js';
import { OneTimeTokenService } from './tokens.service.js';
import { AuditService } from './audit.service.js';
import { SessionService, loadKeyPair } from './sessions.service.js';
import { AuthRateLimiter } from './rate-limit.service.js';
import { NotificationService, type EmailTransport } from '../notification/notification.module.js';
import { authRoutes } from './routes/auth.routes.js';
import { sessionRoutes } from './routes/session.routes.js';

/**
 * Identity module (M1): registration, verification, sessions, rate
 * limiting, password reset. MFA (#26) and RBAC (#28) extend this module.
 */
export const identityModule: AgoraModule = {
  name: 'identity',
  register: async (app: FastifyInstance): Promise<void> => {
    const password = passwordService;
    const tokens = new OneTimeTokenService(app.prisma);
    const audit = new AuditService(app.prisma);
    const notifications = new NotificationService(
      app.prisma,
      (app as FastifyInstance & { emailTransport?: EmailTransport }).emailTransport,
    );

    const keyPair = await loadKeyPair(app.config);
    const sessions = new SessionService(app.prisma, app.config, audit, keyPair);

    const redis = new Redis(app.config.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: true });
    app.addHook('onClose', async () => {
      redis.disconnect();
    });
    const rateLimiter = new AuthRateLimiter(redis, audit);

    await authRoutes(app, {
      prisma: app.prisma,
      config: app.config,
      password,
      tokens,
      audit,
      notifications,
    });
    await sessionRoutes(app, {
      prisma: app.prisma,
      config: app.config,
      sessions,
      rateLimiter,
      password,
      tokens,
      audit,
      notifications,
    });
  },
};
