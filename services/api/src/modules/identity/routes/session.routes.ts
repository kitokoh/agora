import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@agora/db';
import {
  authLoginRequest,
  authRefreshRequest,
  authLogoutRequest,
  passwordResetRequest,
  passwordResetConfirmRequest,
  type AuthLoginRequest,
} from '@agora/contracts';
import type { SessionService } from '../sessions.service.js';
import type { AuthRateLimiter } from '../rate-limit.service.js';
import type { PasswordService } from '../password.service.js';
import type { MfaService } from '../mfa.service.js';
import { type OneTimeTokenService, PASSWORD_RESET_TTL_MS } from '../tokens.service.js';
import { type AuditService } from '../audit.service.js';
import { type NotificationService } from '../../notification/notification.module.js';
import { ApiError } from '../../../plugins/error-handler.js';
import { parseBody } from './validate.js';
import { normalizeEmail } from './auth.routes.js';
import type { AppConfig } from '../../../config.js';

export interface SessionRoutesDeps {
  prisma: PrismaClient;
  config: AppConfig;
  sessions: SessionService;
  rateLimiter: AuthRateLimiter;
  password: PasswordService;
  tokens: OneTimeTokenService;
  audit: AuditService;
  notifications: NotificationService;
  mfa?: MfaService;
}

const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_MAX_FAILURES = 10;

/**
 * Session + recovery routes (M1 — #23 login/refresh/logout, #24 rate
 * limit + lockout, #25 password reset).
 */
export async function sessionRoutes(app: FastifyInstance, deps: SessionRoutesDeps): Promise<void> {
  const { prisma, config, sessions, rateLimiter, password, tokens, audit, notifications } = deps;

  const ctx = (request: { ip: string; headers: Record<string, string | string[] | undefined> }) => ({
    ip: request.ip,
    ua: typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : undefined,
  });

  app.post(
    '/v1/auth/login',
    { config: { rateLimit: { max: 30, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      const { email: rawEmail, password: plain, mfaCode } = parseBody(authLoginRequest, request.body as AuthLoginRequest);
      const email = normalizeEmail(rawEmail);
      const requestCtx = ctx(request);

      await rateLimiter.assertAllowed('login', email, LOGIN_MAX_FAILURES, LOGIN_WINDOW_SECONDS);
      await rateLimiter.assertAllowed('login', request.ip, 30, LOGIN_WINDOW_SECONDS);

      const user = await prisma.user.findUnique({ where: { email } });
      const hash = user?.passwordHash;
      const passwordOk = hash ? await password.verify(hash, plain) : false;

      if (!user || !passwordOk) {
        await rateLimiter.recordFailure('login', email, LOGIN_MAX_FAILURES, LOGIN_WINDOW_SECONDS, {
          actorId: user?.id,
          ...requestCtx,
        });
        throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
      }

      if (user.status === 'suspended') {
        throw new ApiError(403, 'ACCOUNT_SUSPENDED', 'Account is suspended');
      }
      if (!user.emailVerifiedAt) {
        throw new ApiError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email before signing in');
      }

      // Lockout cleared on success.
      await rateLimiter.reset('login', email);

      // MFA gate (FR-004): challenge when enabled; enforcement for
      // seller/staff roles even before enrollment.
      const roles = await sessions.loadRoles(user.id);
      const privileged = roles.some((r) => r === 'seller' || r === 'staff' || r === 'admin');
      if (user.mfaEnabled || (privileged && !user.mfaEnabled)) {
        if (!mfaCode) {
          if (!user.mfaEnabled) {
            // Privileged role without MFA: must enroll first.
            throw new ApiError(428, 'MFA_SETUP_REQUIRED', 'Set up MFA before continuing (seller/staff accounts)');
          }
          const challenge = await sessions.signMfaChallenge(user.id, user.email);
          await audit.record(
            { actorType: 'user', actorId: user.id, ...requestCtx },
            'auth.login_mfa_challenge',
            'user',
            user.id,
          );
          return reply.code(200).send({ mfaRequired: true, challenge, userId: user.id });
        }
        // Complete login with the TOTP code.
        if (!deps.mfa) throw new ApiError(500, 'MFA_UNAVAILABLE', 'MFA is not configured');
        if (!deps.mfa.verifyCode(user.id, user.mfaSecretEnc, mfaCode)) {
          await rateLimiter.recordFailure('mfa', user.id, 10, 15 * 60, { actorId: user.id, ...requestCtx });
          throw new ApiError(401, 'INVALID_MFA_CODE', 'MFA verification failed');
        }
      }

      const shopIds = await sessions.loadShopIds(user.id);
      const result = await sessions.issueTokens(user.id, user.email, roles, shopIds, requestCtx);

      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      await audit.record(
        { actorType: 'user', actorId: user.id, ...requestCtx },
        'auth.login',
        'user',
        user.id,
      );
      return reply.code(200).send(result);
    },
  );

  app.post(
    '/v1/auth/refresh',
    { config: { rateLimit: { max: 60, timeWindow: '15 minutes' } } },
    async (request) => {
      const { refreshToken } = parseBody(authRefreshRequest, request.body);
      const result = await sessions.rotateRefreshToken(refreshToken, ctx(request));
      await audit.record(
        { actorType: 'user', actorId: result.user.id, ...ctx(request) },
        'auth.refresh',
        'user',
        result.user.id,
      );
      return result;
    },
  );

  app.post(
    '/v1/auth/logout',
    { config: { rateLimit: { max: 60, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      const { refreshToken } = parseBody(authLogoutRequest, request.body);
      await sessions.revokeSession(refreshToken, undefined);
      await audit.record(
        { actorType: 'user', actorId: undefined, ...ctx(request) },
        'auth.logout',
      );
      return reply.code(204).send();
    },
  );

  app.post(
    '/v1/auth/reset/request',
    { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      const { email: rawEmail } = parseBody(passwordResetRequest, request.body);
      const email = normalizeEmail(rawEmail);

      const user = await prisma.user.findUnique({ where: { email } });
      // Always 200 — no account enumeration. Only active, verified users
      // receive a reset email.
      if (user && user.status === 'active') {
        const token = await tokens.create(user.id, 'password_reset', PASSWORD_RESET_TTL_MS);
        const resetUrl = `${config.PUBLIC_APP_URL}/reset?token=${token}`;
        await notifications.sendEmail({
          userId: user.id,
          to: email,
          event: 'auth.password_reset',
          subject: 'Reset your Agora password',
          text: `Reset your password with this link (valid 1 hour):\n\n${resetUrl}`,
          referenceId: `reset:${user.id}:${Date.now()}`,
        });
        await audit.record(
          { actorType: 'user', actorId: user.id, ...ctx(request) },
          'auth.reset_requested',
          'user',
          user.id,
        );
      }
      return reply.code(200).send({ ok: true });
    },
  );

  app.post(
    '/v1/auth/reset/confirm',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      const { token, newPassword } = parseBody(passwordResetConfirmRequest, request.body);

      const violations = password.validatePolicy(newPassword);
      if (violations.length > 0) {
        throw new ApiError(422, 'PASSWORD_POLICY', violations.join('; '));
      }

      const userId = await tokens.consume(token, 'password_reset');
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new ApiError(400, 'TOKEN_INVALID', 'Token is invalid');

      const passwordHash = await password.hash(newPassword);
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      // Password change revokes every session.
      await prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await rateLimiter.reset('login', user.email);
      await audit.record(
        { actorType: 'user', actorId: userId, ...ctx(request) },
        'auth.password_reset',
        'user',
        userId,
      );
      return reply.code(200).send({ ok: true });
    },
  );
}
