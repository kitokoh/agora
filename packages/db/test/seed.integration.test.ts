import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Integration test for migrations + seed idempotency against a real
 * PostgreSQL. Gated behind RUN_DB_TESTS=1 because CI has no database:
 *
 *   RUN_DB_TESTS=1 pnpm --filter @agora/db test
 */
const runDbTests = process.env.RUN_DB_TESTS === '1';

const prisma = new PrismaClient();

describe.skipIf(!runDbTests)('database integration', () => {
  beforeAll(async () => {
    // Apply migrations from scratch to prove they are complete and ordered.
    execSync('pnpm prisma migrate deploy', { cwd: import.meta.dirname + '/..', stdio: 'pipe' });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('applies migrations and exposes every context', async () => {
    const { count: roles } = await prisma.$queryRawUnsafe('SELECT COUNT(*)::int AS count FROM "identity"."roles"');
    expect(roles).toBe(0); // seed not run yet
  });

  it('seed is idempotent and creates baseline data', async () => {
    execSync('pnpm tsx src/seed.ts', { cwd: import.meta.dirname + '/..', stdio: 'pipe' });
    execSync('pnpm tsx src/seed.ts', { cwd: import.meta.dirname + '/..', stdio: 'pipe' }); // second run

    const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } });
    expect(roles.map((r) => r.name)).toEqual(['admin', 'buyer', 'seller', 'staff']);

    const perms = await prisma.permission.count();
    expect(perms).toBeGreaterThanOrEqual(15);

    const rolePerms = await prisma.rolePermission.count();
    expect(rolePerms).toBeGreaterThanOrEqual(perms); // matrix wired

    const plans = await prisma.plan.findMany({ orderBy: { code: 'asc' } });
    expect(plans.map((p) => p.code)).toEqual(['free', 'plus', 'pro']);
    expect(plans.every((p) => typeof p.priceMinor === 'bigint')).toBe(true);

    // No duplicates after double-seed.
    const dupRoles = await prisma.role.groupBy({ by: ['name'], _count: { _all: true } });
    expect(dupRoles.every((r) => r._count._all === 1)).toBe(true);
  });
});
