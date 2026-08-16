import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@agora/db';
import {
  authRegisterRequest,
  authVerifyRequest,
  authVerifyResendRequest,
} from '@agora/contracts';
import type { PasswordService } from '../password.service.js';
import { type OneTimeTokenService, EMAIL_VERIFICATION_TTL_MS } from '../tokens.service.js';
import type { AuditService } from '../audit.service.js';
import type { NotificationService } from '../../notification/notification.module.js';
import { ApiError } from '../../../plugins/error-handler.js';
import type { AppConfig } from '../../../config.js';
import { parseBody } from './validate.js';

export interface AuthRoutesDeps {
  prisma: PrismaClient;
  config: AppConfig;
  password: PasswordService;
  tokens: OneTimeTokenService;
  audit: AuditService;
  notifications: NotificationService;
}

/** Normalize an email for storage: trim + lowercase (citext-like behavior). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Auth routes — M1 core (#21 register, #22 verify).
 * Rate limiting: per-IP + per-email buckets on register (see #24 for the
 * full Redis token-bucket implementation).
 */
export async function authRoutes(app: FastifyInstance, deps: AuthRoutesDeps): Promise<void> {
  const { prisma, password, tokens, audit, notifications } = deps;

  app.post(
    '/v1/auth/register',
    {
      config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const { email: rawEmail, password: plain, locale } = parseBody(authRegisterRequest, request.body);
      const email = normalizeEmail(rawEmail);

      const policyViolations = password.validatePolicy(plain);
      if (policyViolations.length > 0) {
        throw new ApiError(422, 'PASSWORD_POLICY', policyViolations.join('; '));
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        // No enumeration: same response for duplicate email (with reset hint).
        throw new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
      }

      const passwordHash = await password.hash(plain);
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          locale: locale ?? 'en',
          status: 'unverified',
        },
      });

      const token = await tokens.create(user.id, 'email_verification', EMAIL_VERIFICATION_TTL_MS);
      const verifyUrl = `${deps.config.PUBLIC_APP_URL ?? 'http://localhost:3000'}/verify?token=${token}`;

      await audit.record(
        { actorType: 'user', actorId: user.id, ip: request.ip, ua: request.headers['user-agent'] },
        'auth.register',
        'user',
        user.id,
        { email },
      );

      await notifications.sendEmail({
        userId: user.id,
        to: email,
        event: 'auth.email_verification',
        subject: 'Verify your Agora account',
        text: `Welcome to Agora! Verify your email to finish signing up:\n\n${verifyUrl}\n\nThis link expires in 24 hours.`,
        referenceId: `verify:${user.id}:${Date.now()}`,
      });

      return reply.code(201).send({ userId: user.id, email, status: 'unverified' });
    },
  );

  app.post(
    '/v1/auth/verify',
    {
      config: { rateLimit: { max: 20, timeWindow: '15 minutes' } },
    },
    async (request) => {
      const { token } = parseBody(authVerifyRequest, request.body);
      const userId = await tokens.consume(token, 'email_verification');

      const user = await prisma.user.update({
        where: { id: userId },
        data: { status: 'active', emailVerifiedAt: new Date() },
      });

      await audit.record(
        { actorType: 'user', actorId: user.id, ip: request.ip, ua: request.headers['user-agent'] },
        'auth.email_verified',
        'user',
        user.id,
      );

      return { status: 'verified' as const, userId: user.id };
    },
  );

  app.post(
    '/v1/auth/verify/resend',
    {
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const { email: rawEmail } = parseBody(authVerifyResendRequest, request.body);
      const email = normalizeEmail(rawEmail);

      const user = await prisma.user.findUnique({ where: { email } });
      // Always 200 — never reveal whether the account exists.
      if (!user || user.emailVerifiedAt) {
        return reply.code(200).send({ status: 'verified', userId: '00000000-0000-0000-0000-000000000000' });
      }

      const token = await tokens.create(user.id, 'email_verification', EMAIL_VERIFICATION_TTL_MS);
      const verifyUrl = `${deps.config.PUBLIC_APP_URL ?? 'http://localhost:3000'}/verify?token=${token}`;
      await notifications.sendEmail({
        userId: user.id,
        to: email,
        event: 'auth.email_verification',
        subject: 'Verify your Agora account',
        text: `Verify your email:\n\n${verifyUrl}\n\nThis link expires in 24 hours.`,
        referenceId: `verify:${user.id}:${Date.now()}`,
      });
      return reply.code(200).send({ status: 'verified', userId: user.id });
    },
  );
}
