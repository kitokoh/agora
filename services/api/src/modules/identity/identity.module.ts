import type { FastifyInstance } from 'fastify';
import type { AgoraModule } from '../index.js';
import { passwordService } from './password.service.js';
import { OneTimeTokenService } from './tokens.service.js';
import { AuditService } from './audit.service.js';
import { NotificationService, type EmailTransport } from '../notification/notification.module.js';
import { authRoutes } from './routes/auth.routes.js';

/**
 * Identity module (M1): registration, verification, sessions, MFA, RBAC.
 * Routes are added incrementally as issues #23-#28 land.
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

    await authRoutes(app, {
      prisma: app.prisma,
      config: app.config,
      password,
      tokens,
      audit,
      notifications,
    });
  },
};
