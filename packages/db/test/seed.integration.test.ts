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
const DB_DIR = import.meta.dirname + '/..';

describe.skipIf(!runDbTests)('database integration', () => {
  beforeAll(async () => {
    // Apply migrations (idempotent — no-ops when already applied).
    execSync('pnpm prisma migrate deploy', { cwd: DB_DIR, stdio: 'pipe' });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates tables in every bounded-context schema', async () => {
    const rows = await prisma.$queryRawUnsafe<{ schema_name: string; table_count: number }[]>(
      `SELECT n.nspname AS schema_name, count(*)::int AS table_count
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relkind = 'r' AND n.nspname IN
         ('identity','marketplace','catalog','orders','payments','finance','notification','audit')
       GROUP BY n.nspname ORDER BY n.nspname`,
    );
    expect(rows.length).toBe(8);
    for (const row of rows) {
      expect(row.table_count, `schema ${row.schema_name} has no tables`).toBeGreaterThan(0);
    }
  });

  it('seed is idempotent and creates baseline data', async () => {
    execSync('pnpm tsx src/seed.ts', { cwd: DB_DIR, stdio: 'pipe' });
    execSync('pnpm tsx src/seed.ts', { cwd: DB_DIR, stdio: 'pipe' }); // second run must not duplicate

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
    const dupPlans = await prisma.plan.groupBy({ by: ['code'], _count: { _all: true } });
    expect(dupPlans.every((p) => p._count._all === 1)).toBe(true);
  });
});
