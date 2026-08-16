import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PrismaClient } from '@agora/db';
import { EMAIL_VERIFICATION_TTL_MS, type OneTimeTokenService } from '../tokens.service.js';
import { parseBody } from './validate.js';
import { normalizeEmail } from './auth.routes.js';
import { ApiError } from '../../../plugins/error-handler.js';

const emailRequest = z.object({ email: z.string().trim().email() });

/**
 * E2E test hooks — ONLY enabled when E2E_TOKEN_HOOK=true (dev/staging).
 * Lets the Playwright suite obtain the verification token without a
 * mailbox. Never enable in production (config default is false).
 */
export async function e2eHookRoutes(app: FastifyInstance, deps: { prisma: PrismaClient; tokens: OneTimeTokenService }): Promise<void> {
  if (!app.config.E2E_TOKEN_HOOK) return;

  app.post('/v1/internal/e2e/verification-token', async (request, reply) => {
    const { email } = parseBody(emailRequest, request.body);
    const user = await deps.prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
    if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
    const token = await deps.tokens.create(user.id, 'email_verification', EMAIL_VERIFICATION_TTL_MS);
    return reply.code(200).send({ token });
  });
}
