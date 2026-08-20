import { PrismaClient } from '@prisma/client';

/**
 * Idempotent seed for platform baseline data:
 *   - RBAC: roles (buyer/seller/staff/admin) + permission matrix
 *   - Plans: free / plus / pro (marketplace)
 *
 * Safe to run repeatedly (`pnpm --filter @agora/db seed`): every write is
 * an upsert keyed on natural unique keys.
 */
const prisma = new PrismaClient();

const ROLES = [
  { name: 'buyer', scope: 'platform', description: 'Registered buyer — can browse, order, review' },
  { name: 'seller', scope: 'shop', description: 'Shop owner — manages own shop, catalog, orders' },
  { name: 'staff', scope: 'platform', description: 'Platform staff — moderation, KYC review, support' },
  { name: 'admin', scope: 'platform', description: 'Platform administrator — full access' },
] as const;

// Permission matrix: role -> permission keys (AGENTS.md §7, ADR-0007).
const PERMISSIONS: Record<string, string[]> = {
  buyer: ['catalog:read', 'orders:create', 'orders:read', 'reviews:write'],
  seller: [
    'catalog:read',
    'catalog:write',
    'inventory:write',
    'orders:read',
    'orders:fulfill',
    'payouts:read',
    'shops:manage',
    'kyc:submit',
  ],
  staff: [
    'moderation:review',
    'kyc:review',
    'disputes:manage',
    'shops:read',
    'orders:read',
    'finance:read',
  ],
  admin: [
    'catalog:write',
    'inventory:write',
    'orders:read',
    'orders:fulfill',
    'payouts:read',
    'payouts:approve',
    'shops:read',
    'shops:manage',
    'users:manage',
    'moderation:review',
    'kyc:review',
    'disputes:manage',
    'finance:read',
    'platform:configure',
    'audit:read',
  ],
};

const PLANS = [
  { code: 'free', name: 'Free', priceMinor: 0n, features: { customDomain: false, bulkImport: false, commissionBp: 500 } },
  { code: 'plus', name: 'Plus', priceMinor: 2900n, features: { customDomain: false, bulkImport: true, commissionBp: 400 } },
  { code: 'pro', name: 'Pro', priceMinor: 9900n, features: { customDomain: true, bulkImport: true, commissionBp: 300 } },
] as const;

async function seedPermissions(): Promise<void> {
  const keys = new Set(Object.values(PERMISSIONS).flat());
  for (const key of keys) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key },
    });
  }
  console.log(`seeded ${keys.size} permissions`);
}

async function seedRoles(): Promise<void> {
  for (const role of ROLES) {
    const { name, scope, description } = role;
    const record = await prisma.role.upsert({
      where: { name },
      update: { scope, description },
      create: { name, scope, description },
    });

    // Reconcile the permission matrix for this role (additive; never deletes).
    for (const key of PERMISSIONS[role.name] ?? []) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: record.id, permissionId: key } },
        update: {},
        create: { roleId: record.id, permissionId: key },
      });
    }
  }
  console.log(`seeded ${ROLES.length} roles with permission matrix`);
}

async function seedPlans(): Promise<void> {
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: { name: plan.name, priceMinor: plan.priceMinor, features: plan.features },
      create: {
        code: plan.code,
        name: plan.name,
        priceMinor: plan.priceMinor,
        features: plan.features,
        billingCycle: 'monthly',
      },
    });
  }
  console.log(`seeded ${PLANS.length} plans`);
}


// Notification templates (#30) — versioned, seeded idempotently.
const TEMPLATES: { channel: string; event: string; subject: string; body: string }[] = [
  {
    channel: 'email',
    event: 'auth.email_verification',
    subject: 'Verify your Agora account',
    body: 'Welcome to Agora! Verify your email to finish signing up:\n\n{{verifyUrl}}\n\nThis link expires in 24 hours.',
  },
  {
    channel: 'email',
    event: 'auth.welcome',
    subject: 'Welcome to Agora, {{name}}!',
    body: 'Hi {{name}},\n\nYour account is verified. Start selling or shopping on Agora.',
  },
  {
    channel: 'email',
    event: 'auth.password_reset',
    subject: 'Reset your Agora password',
    body: 'Reset your password with this link (valid 1 hour):\n\n{{resetUrl}}',
  },
  {
    channel: 'email',
    event: 'auth.login_alert',
    subject: 'New sign-in to your Agora account',
    body: 'We noticed a new sign-in to your account from {{ip}} ({{ua}}) at {{at}}. If this was you, no action needed.',
  },
  {
    channel: 'email',
    event: 'auth.mfa_setup',
    subject: 'Set up two-factor authentication',
    body: 'Two-factor authentication is required for your account. Follow the setup flow at {{mfaUrl}}.',
  },
  {
    channel: 'email',
    event: 'marketplace.shop_approved',
    subject: 'Your shop is live!',
    body: 'Congratulations {{name}} — {{shopName}} is now active on Agora. Start adding products.',
  },
  {
    channel: 'email',
    event: 'marketplace.shop_suspended',
    subject: 'Important: your shop was suspended',
    body: 'Your shop {{shopName}} has been suspended. Contact support for details.',
  },
];

async function seedNotificationTemplates(): Promise<void> {
  for (const t of TEMPLATES) {
    await prisma.notificationTemplate.upsert({
      where: {
        channel_event_locale_version: {
          channel: t.channel as 'email',
          event: t.event,
          locale: 'en',
          version: 1,
        },
      },
      update: { subject: t.subject, body: t.body },
      create: { channel: t.channel as 'email', event: t.event, locale: 'en', subject: t.subject, body: t.body, version: 1 },
    });
  }
  console.log(`seeded ${TEMPLATES.length} notification templates`);
}


/** Starter category set (M2 — issue #65): 3 top-level, 6 children. */
const CATEGORIES: { slug: string; name: string; parent?: string }[] = [
  { slug: 'fashion', name: 'Fashion' },
  { slug: 'fashion-womens', name: 'Women\'s', parent: 'fashion' },
  { slug: 'fashion-mens', name: 'Men\'s', parent: 'fashion' },
  { slug: 'fashion-accessories', name: 'Accessories', parent: 'fashion' },
  { slug: 'home', name: 'Home & Living' },
  { slug: 'home-decor', name: 'Decor', parent: 'home' },
  { slug: 'home-keepsakes', name: 'Keepsakes', parent: 'home' },
  { slug: 'art', name: 'Art & Collectibles' },
  { slug: 'art-prints', name: 'Prints', parent: 'art' },
  { slug: 'art-originals', name: 'Original works', parent: 'art' },
];

async function seedCategories(): Promise<void> {
  const bySlug = new Map<string, string>();
  for (const c of CATEGORIES) {
    const record = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name },
      create: { slug: c.slug, name: c.name, attributesSchema: {} },
    });
    bySlug.set(c.slug, record.id);
  }
  for (const c of CATEGORIES) {
    if (!c.parent) continue;
    const parentId = bySlug.get(c.parent);
    if (parentId) {
      await prisma.category.update({
        where: { slug: c.slug },
        data: { parentId },
      });
    }
  }
  console.log(`seeded ${CATEGORIES.length} categories`);
}

async function main(): Promise<void> {
  await seedPermissions();
  await seedRoles();
  await seedPlans();
  await seedNotificationTemplates();
  await seedCategories();
  console.log('seed complete');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
