import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@agora/db';
import { z } from 'zod';
import { MfaService } from '../mfa.service.js';
import type { SessionService } from '../sessions.service.js';
import type { PasswordService } from '../password.service.js';
import type { AuditService } from '../audit.service.js';
import type { AuthRateLimiter } from '../rate-limit.service.js';
import { ApiError } from '../../../plugins/error-handler.js';
import { parseBody } from './validate.js';
import type { AppConfig } from '../../../config.js';

const mfaEnableRequest = z.object({
  password: z.string().min(1).max(128),
  secret: z.string().min(16).max(128),
  code: z.string().regex(/^\d{6}$/),
});
const mfaVerifyRequest = z.object({
  challenge: z.string().min(16).max(1024),
  code: z.string().regex(/^\d{6}$/).optional(),
  recoveryCode: z.string().min(6).max(16).optional(),
});
const mfaDisableRequest = z.object({
  password: z.string().min(1).max(128),
  code: z.string().regex(/^\d{6}$/),
});
const mfaRecoveryRequest = z.object({
  password: z.string().min(1).max(128),
  code: z.string().regex(/^\d{6}$/),
});

export interface MfaRoutesDeps {
  prisma: PrismaClient;
  config: AppConfig;
  mfa: MfaService;
  sessions: SessionService;
  password: PasswordService;
  audit: AuditService;
  rateLimiter: AuthRateLimiter;
}

/**
 * MFA routes (issue #26): TOTP enrollment, login completion, recovery
 * codes, and seller/staff enforcement.
 */
export async function mfaRoutes(app: FastifyInstance, deps: MfaRoutesDeps): Promise<void> {
  const { prisma, mfa, sessions, password, audit, rateLimiter } = deps;
  const ctx = (request: { ip: string; headers: Record<string, string | string[] | undefined> }) => ({
    ip: request.ip,
    ua: typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : undefined,
  });

  app.post(
    '/v1/auth/mfa/setup',
    { config: { rateLimit: { max: 20, timeWindow: '15 minutes' } }, preHandler: app.requirePerm() },
    async (request, reply) => {
      const actor = request.actor!;
      const user = await prisma.user.findUnique({ where: { id: actor.userId } });
      if (user?.mfaEnabled) {
        throw new ApiError(409, 'MFA_ALREADY_ENABLED', 'MFA is already enabled');
      }
      const { secret, otpauthUrl } = mfa.generateSecret();
      await audit.record(
        { actorType: 'user', actorId: actor.userId, ip: request.ip, ua: request.headers['user-agent'] },
        'auth.mfa_setup',
        'user',
        actor.userId,
      );
      return reply.code(200).send({ secret, otpauthUrl });
    },
  );

  app.post(
    '/v1/auth/mfa/enable',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } }, preHandler: app.requirePerm() },
    async (request, reply) => {
      const { password: plain, secret, code } = parseBody(mfaEnableRequest, request.body);
      const actor = request.actor!;
      const user = await prisma.user.findUnique({ where: { id: actor.userId } });
      if (!user?.passwordHash || !(await password.verify(user.passwordHash, plain))) {
        throw new ApiError(401, 'INVALID_CREDENTIALS', 'Password is incorrect');
      }
      if (!MfaService.verifySecret(secret, code)) {
        throw new ApiError(401, 'INVALID_MFA_CODE', 'The verification code is invalid');
      }

      await mfa.enable(actor.userId, secret);
      const { plain: recoveryCodes } = mfa.generateRecoveryCodes();
      await mfa.storeRecoveryCodes(actor.userId, recoveryCodes.map(MfaService.hashRecoveryCode));

      await audit.record(
        { actorType: 'user', actorId: actor.userId, ip: request.ip, ua: request.headers['user-agent'] },
        'auth.mfa_enabled',
        'user',
        actor.userId,
      );
      return reply.code(200).send({ mfaEnabled: true, recoveryCodes });
    },
  );

  app.post(
    '/v1/auth/mfa/verify',
    { config: { rateLimit: { max: 15, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      const { challenge, code, recoveryCode } = parseBody(mfaVerifyRequest, request.body);
      const { userId } = await sessions.verifyMfaChallenge(challenge);

      await rateLimiter.assertAllowed('mfa', userId, 10, 15 * 60);
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new ApiError(401, 'MFA_CHALLENGE_INVALID', 'Challenge is invalid');

      let verified = false;
      if (code) {
        verified = mfa.verifyCode(userId, user.mfaSecretEnc, code);
      } else if (recoveryCode) {
        verified = await mfa.consumeRecoveryCode(userId, recoveryCode);
      }
      if (!verified) {
        await rateLimiter.recordFailure('mfa', userId, 10, 15 * 60, { actorId: userId });
        throw new ApiError(401, 'INVALID_MFA_CODE', 'MFA verification failed');
      }
      await rateLimiter.reset('mfa', userId);

      const roles = await sessions.loadRoles(userId);
      const shopIds = await sessions.loadShopIds(userId);
      const result = await sessions.issueTokens(userId, user.email, roles, shopIds, ctx(request));
      await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
      await audit.record(
        { actorType: 'user', actorId: userId, ...ctx(request) },
        'auth.login_mfa_verified',
        'user',
        userId,
      );
      return reply.code(200).send(result);
    },
  );

  app.post(
    '/v1/auth/mfa/disable',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } }, preHandler: app.requirePerm() },
    async (request, reply) => {
      const { password: plain, code } = parseBody(mfaDisableRequest, request.body);
      const actor = request.actor!;
      const user = await prisma.user.findUnique({ where: { id: actor.userId } });
      if (!user?.passwordHash || !(await password.verify(user.passwordHash, plain))) {
        throw new ApiError(401, 'INVALID_CREDENTIALS', 'Password is incorrect');
      }
      if (!mfa.verifyCode(actor.userId, user.mfaSecretEnc, code)) {
        throw new ApiError(401, 'INVALID_MFA_CODE', 'The verification code is invalid');
      }
      await mfa.disable(actor.userId);
      await sessions.revokeFamilyBySessionId(actor.sessionId);
      await audit.record(
        { actorType: 'user', actorId: actor.userId, ip: request.ip, ua: request.headers['user-agent'] },
        'auth.mfa_disabled',
        'user',
        actor.userId,
      );
      return reply.code(200).send({ mfaEnabled: false });
    },
  );

  app.post(
    '/v1/auth/mfa/recovery',
    { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } }, preHandler: app.requirePerm() },
    async (request, reply) => {
      const { password: plain, code } = parseBody(mfaRecoveryRequest, request.body);
      const actor = request.actor!;
      const user = await prisma.user.findUnique({ where: { id: actor.userId } });
      if (!user?.passwordHash || !(await password.verify(user.passwordHash, plain))) {
        throw new ApiError(401, 'INVALID_CREDENTIALS', 'Password is incorrect');
      }
      if (!mfa.verifyCode(actor.userId, user.mfaSecretEnc, code)) {
        throw new ApiError(401, 'INVALID_MFA_CODE', 'The verification code is invalid');
      }
      const { plain: codes } = mfa.generateRecoveryCodes();
      await mfa.storeRecoveryCodes(actor.userId, codes.map(MfaService.hashRecoveryCode));
      await audit.record(
        { actorType: 'user', actorId: actor.userId, ip: request.ip, ua: request.headers['user-agent'] },
        'auth.mfa_recovery_regenerated',
        'user',
        actor.userId,
      );
      return reply.code(200).send({ recoveryCodes: codes });
    },
  );
}
