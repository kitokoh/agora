import type { FastifyInstance } from 'fastify';
import { type Prisma, type PrismaClient } from '@agora/db';
import { z } from 'zod';
import { ApiError } from '../../../plugins/error-handler.js';
import { parseBody } from './validate.js';
import type { AuditService } from '../audit.service.js';
import type { NotificationService } from '../../notification/notification.module.js';
import type { SessionService } from '../sessions.service.js';
import type { AppConfig } from '../../../config.js';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const profileRequest = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().max(32).optional(),
  country: z.string().length(2).optional(),
  bio: z.string().max(500).optional(),
});

const shopRequest = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(3).max(63).regex(SLUG_PATTERN, 'Slug must be lowercase letters, digits, and hyphens'),
});

const kycRequest = z.object({
  entityType: z.enum(['individual', 'company']),
  docsRefs: z.array(z.string()).max(10).default([]),
});

export interface OnboardingRoutesDeps {
  prisma: PrismaClient;
  config: AppConfig;
  audit: AuditService;
  notifications: NotificationService;
  sessions: SessionService;
}

/**
 * Seller onboarding (issue #29): profile → shop (draft) → KYC → submit →
 * admin approval (or auto-approve in dev) → active. State is resumable.
 */
export async function onboardingRoutes(app: FastifyInstance, deps: OnboardingRoutesDeps): Promise<void> {
  const { prisma, config, audit, notifications, sessions } = deps;
  const auth = { preHandler: app.requirePerm() };

  const autoApprove = config.AUTO_APPROVE_SHOPS ?? config.NODE_ENV !== 'production';

  app.get('/v1/onboarding/status', auth, async (request) => {
    const actor = request.actor!;
    const [profile, shop, kyc] = await Promise.all([
      prisma.sellerProfile.findUnique({ where: { userId: actor.userId } }),
      prisma.shop.findFirst({ where: { ownerId: actor.userId } }),
      prisma.sellerKyc.findFirst({ where: { shop: { ownerId: actor.userId } } }),
    ]);
    const step = !profile ? 'profile' : !shop ? 'shop' : !kyc || kyc.verificationState === 'not_started' ? 'kyc' : kyc.verificationState === 'submitted' || kyc.verificationState === 'approved' ? 'done' : 'kyc';
    return {
      step,
      profileComplete: Boolean(profile),
      shop: shop ? { id: shop.id, name: shop.name, slug: shop.slug, status: shop.status } : null,
      kyc: kyc ? { state: kyc.verificationState } : null,
    };
  });

  app.post('/v1/onboarding/profile', { ...auth, config: { rateLimit: { max: 30, timeWindow: '15 minutes' } } }, async (request) => {
    const actor = request.actor!;
    const data = parseBody(profileRequest, request.body);
    const profile = await prisma.sellerProfile.upsert({
      where: { userId: actor.userId },
      update: data,
      create: { userId: actor.userId, ...data },
    });
    await audit.record(
      { actorType: 'user', actorId: actor.userId, ip: request.ip, ua: request.headers['user-agent'] },
      'onboarding.profile',
      'seller_profile',
      profile.id,
    );
    return { ok: true, profile };
  });

  app.post('/v1/onboarding/shop', { ...auth, config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const actor = request.actor!;
    const { name, slug } = parseBody(shopRequest, request.body);

    const existing = await prisma.shop.findFirst({ where: { ownerId: actor.userId } });
    if (existing) {
      throw new ApiError(409, 'SHOP_EXISTS', 'You already have a shop');
    }
    const slugTaken = await prisma.shop.findUnique({ where: { slug } });
    if (slugTaken) {
      throw new ApiError(409, 'SLUG_TAKEN', 'That shop slug is already taken');
    }

    const shop = await prisma.shop.create({
      data: { ownerId: actor.userId, name, slug, status: 'draft' },
    });

    // Grant the shop-scoped seller role.
    const sellerRole = await prisma.role.findUnique({ where: { name: 'seller' } });
    if (sellerRole) {
      await prisma.roleAssignment.create({
        data: { userId: actor.userId, roleId: sellerRole.id, shopId: shop.id },
      });
    }

    await audit.record(
      { actorType: 'user', actorId: actor.userId, ip: request.ip, ua: request.headers['user-agent'] },
      'onboarding.shop_created',
      'shop',
      shop.id,
      { slug },
    );
    return reply.code(201).send({ shop: { id: shop.id, name: shop.name, slug: shop.slug, status: shop.status } });
  });

  app.post('/v1/onboarding/kyc', { ...auth, config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } }, async (request) => {
    const actor = request.actor!;
    const shop = await prisma.shop.findFirst({ where: { ownerId: actor.userId } });
    if (!shop) throw new ApiError(409, 'SHOP_REQUIRED', 'Create a shop before submitting KYC');
    const data = parseBody(kycRequest, request.body);

    const kyc = await prisma.sellerKyc.upsert({
      where: { shopId: shop.id },
      update: { entityType: data.entityType, docsRefs: data.docsRefs as Prisma.InputJsonValue, verificationState: 'draft' },
      create: { shopId: shop.id, entityType: data.entityType, docsRefs: data.docsRefs as Prisma.InputJsonValue, verificationState: 'draft' },
    });
    await audit.record(
      { actorType: 'user', actorId: actor.userId, ip: request.ip, ua: request.headers['user-agent'] },
      'onboarding.kyc_draft',
      'seller_kyc',
      kyc.id,
    );
    return { ok: true, kyc: { state: kyc.verificationState } };
  });

  app.post('/v1/onboarding/submit', { ...auth, config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const actor = request.actor!;
    const shop = await prisma.shop.findFirst({ where: { ownerId: actor.userId } });
    if (!shop) throw new ApiError(409, 'SHOP_REQUIRED', 'Create a shop before submitting KYC');
    const kyc = await prisma.sellerKyc.findUnique({ where: { shopId: shop.id } });
    if (!kyc) throw new ApiError(409, 'KYC_REQUIRED', 'Complete KYC before submitting');

    const kycUpdated = await prisma.sellerKyc.update({
      where: { id: kyc.id },
      data: { verificationState: 'submitted' },
    });

    if (autoApprove) {
      await prisma.sellerKyc.update({ where: { id: kyc.id }, data: { verificationState: 'approved', verifiedAt: new Date() } });
      await prisma.shop.update({ where: { id: shop.id }, data: { status: 'active' } });
      await notifications.sendEmail({
        userId: actor.userId,
        to: actor.email,
        event: 'marketplace.shop_approved',
        vars: { name: actor.email, shopName: shop.name },
        referenceId: `approve:${shop.id}:${Date.now()}`,
      });
      await audit.record(
        { actorType: 'system', actorId: actor.userId, ip: request.ip, ua: request.headers['user-agent'] },
        'onboarding.auto_approved',
        'shop',
        shop.id,
      );
      return reply.code(200).send({ status: 'active', shopId: shop.id, autoApproved: true });
    }

    await audit.record(
      { actorType: 'user', actorId: actor.userId, ip: request.ip, ua: request.headers['user-agent'] },
      'onboarding.submitted',
      'shop',
      shop.id,
    );
    void kycUpdated;
    return reply.code(200).send({ status: 'pending_review', shopId: shop.id, autoApproved: false });
  });

  // -- Admin actions -------------------------------------------------------

  app.post(
    '/v1/admin/shops/:id/approve',
    { preHandler: app.requirePerm('shops:manage') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const shop = await prisma.shop.findUnique({ where: { id } });
      if (!shop) throw new ApiError(404, 'SHOP_NOT_FOUND', 'Shop not found');

      await prisma.sellerKyc.updateMany({
        where: { shopId: shop.id, verificationState: 'submitted' },
        data: { verificationState: 'approved', verifiedAt: new Date() },
      });
      await prisma.shop.update({ where: { id }, data: { status: 'active' } });

      const owner = await prisma.user.findUnique({ where: { id: shop.ownerId } });
      if (owner) {
        await notifications.sendEmail({
          userId: owner.id,
          to: owner.email,
          event: 'marketplace.shop_approved',
          vars: { name: owner.email, shopName: shop.name },
          referenceId: `approve:${shop.id}:${Date.now()}`,
        });
      }
      await audit.record(
        { actorType: 'staff', actorId: request.actor!.userId, ip: request.ip, ua: request.headers['user-agent'] },
        'admin.shop_approved',
        'shop',
        shop.id,
      );
      return reply.code(200).send({ shopId: shop.id, status: 'active' });
    },
  );

  app.post(
    '/v1/admin/shops/:id/suspend',
    { preHandler: app.requirePerm('shops:manage') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const shop = await prisma.shop.findUnique({ where: { id } });
      if (!shop) throw new ApiError(404, 'SHOP_NOT_FOUND', 'Shop not found');
      await prisma.shop.update({ where: { id }, data: { status: 'suspended' } });

      const owner = await prisma.user.findUnique({ where: { id: shop.ownerId } });
      if (owner) {
        await notifications.sendEmail({
          userId: owner.id,
          to: owner.email,
          event: 'marketplace.shop_suspended',
          vars: { shopName: shop.name },
          referenceId: `suspend:${shop.id}:${Date.now()}`,
        });
      }
      await audit.record(
        { actorType: 'staff', actorId: request.actor!.userId, ip: request.ip, ua: request.headers['user-agent'] },
        'admin.shop_suspended',
        'shop',
        shop.id,
      );
      return reply.code(200).send({ shopId: shop.id, status: 'suspended' });
    },
  );

  app.post(
    '/v1/admin/shops/:id/reinstate',
    { preHandler: app.requirePerm('shops:manage') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const shop = await prisma.shop.findUnique({ where: { id } });
      if (!shop) throw new ApiError(404, 'SHOP_NOT_FOUND', 'Shop not found');
      await prisma.shop.update({ where: { id }, data: { status: 'active' } });
      await audit.record(
        { actorType: 'staff', actorId: request.actor!.userId, ip: request.ip, ua: request.headers['user-agent'] },
        'admin.shop_reinstated',
        'shop',
        shop.id,
      );
      return reply.code(200).send({ shopId: shop.id, status: 'active' });
    },
  );

  // Refresh the actor's shop-scoped roles after shop creation (session tokens
  // carry shopIds; new sessions pick them up naturally).
  void sessions;
}
