import { execSync } from 'node:child_process';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type PrismaClient } from '@agora/db';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { EmailMessage, EmailTransport } from '../src/modules/notification/notification.module.js';

/**
 * Catalog integration tests (M2 — issues #64/#65) against a real PostgreSQL.
 * Uses its OWN database (agora_test_catalog) so it can run in parallel with
 * the identity suite (which DROP/CREATEs agora_test in beforeAll).
 *
 *   RUN_DB_TESTS=1 pnpm --filter @agora/api test
 */
const runDbTests = process.env.RUN_DB_TESTS === '1';

const TEST_DATABASE_URL =
  process.env.CATALOG_TEST_DATABASE_URL ??
  'postgresql://agora:agora@localhost:5432/agora_test_catalog?schema=public';
const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/15';
const RUN = Date.now();
let seq = 0;
const unique = (prefix: string): string => `${prefix}-${RUN}-${seq++}`;

class InMemoryTransport implements EmailTransport {
  messages: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.messages.push(message);
  }
}

interface Seller {
  token: string;
  userId: string;
  shopId: string;
  slug: string;
}

describe.skipIf(!runDbTests)('catalog integration (#64/#65)', () => {
  let prisma: PrismaClient;
  let transport: InMemoryTransport;
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    execSync(
      `psql postgresql://agora:agora@localhost:5432/postgres -c "DROP DATABASE IF EXISTS agora_test_catalog;" -c "CREATE DATABASE agora_test_catalog OWNER agora;"`,
      { stdio: 'pipe' },
    );
    execSync('pnpm exec prisma migrate deploy', {
      cwd: import.meta.dirname + '/../../../packages/db',
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: 'pipe',
    });
    execSync('pnpm exec tsx src/seed.ts', {
      cwd: import.meta.dirname + '/../../../packages/db',
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: 'pipe',
    });

    const { Redis } = await import('ioredis');
    const redis = new Redis(TEST_REDIS_URL);
    await redis.flushdb();
    redis.disconnect();

    prisma = createPrismaClient({ datasourceUrl: TEST_DATABASE_URL });
    await prisma.$connect();
    transport = new InMemoryTransport();

    const config = loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      REDIS_URL: TEST_REDIS_URL,
      PUBLIC_APP_URL: 'http://localhost:3000',
      MFA_ENCRYPTION_KEY: 'test-mfa-key-0123456789abcdef',
    });
    app = await buildApp({ logger: pino({ level: 'silent' }), config, emailTransport: transport });
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  /** Register → verify → login → profile → shop → submit → active seller. */
  async function makeSeller(): Promise<Seller> {
    const email = unique('seller') + '@example.com';
    await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email, password: 'valid-pass-123' },
    });
    const url = transport.messages.at(-1)!.text!;
    const token = /token=([^\s]+)/.exec(url)![1]!;
    await app.inject({ method: 'POST', url: '/v1/auth/verify', payload: { token } });

    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password: 'valid-pass-123' },
    });
    const { accessToken } = login.json() as { accessToken: string };
    const auth = { authorization: `Bearer ${accessToken}` };

    await app.inject({
      method: 'POST',
      url: '/v1/onboarding/profile',
      headers: auth,
      payload: { fullName: 'Catalog Tester', country: 'FR' },
    });
    const shopSlug = unique('shop');
    await app.inject({
      method: 'POST',
      url: '/v1/onboarding/shop',
      headers: auth,
      payload: { name: 'Catalog Shop', slug: shopSlug },
    });
    await app.inject({
      method: 'POST',
      url: '/v1/onboarding/kyc',
      headers: auth,
      payload: { entityType: 'individual', docsRefs: ['passport-1'] },
    });
    const submit = await app.inject({
      method: 'POST',
      url: '/v1/onboarding/submit',
      headers: auth,
      payload: {},
    });
    expect(submit.statusCode).toBe(200);
    // The seller role is assigned when the shop is created. Privileged roles
    // must enroll MFA (FR-004, 428 gate), so complete TOTP setup with the
    // pre-role token, then login → challenge → verify for a fresh token.
    const { authenticator } = await import('otplib');
    const setup = await app.inject({
      method: 'POST',
      url: '/v1/auth/mfa/setup',
      headers: auth,
      payload: {},
    });
    expect(setup.statusCode).toBe(200);
    const { secret } = setup.json() as { secret: string };
    const enable = await app.inject({
      method: 'POST',
      url: '/v1/auth/mfa/enable',
      headers: auth,
      payload: { password: 'valid-pass-123', secret, code: authenticator.generate(secret) },
    });
    expect(enable.statusCode).toBe(200);

    const relogin = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password: 'valid-pass-123' },
    });
    expect(relogin.statusCode).toBe(200);
    const challengeBody = relogin.json() as { mfaRequired: boolean; challenge: string };
    expect(challengeBody.mfaRequired).toBe(true);
    const verified = await app.inject({
      method: 'POST',
      url: '/v1/auth/mfa/verify',
      payload: { challenge: challengeBody.challenge, code: authenticator.generate(secret) },
    });
    expect(verified.statusCode).toBe(200);
    const { accessToken: freshToken } = verified.json() as { accessToken: string };
    const shop = await prisma.shop.findUniqueOrThrow({ where: { slug: shopSlug } });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    return { token: freshToken, userId: user.id, shopId: shop.id, slug: shopSlug };
  }

  function productPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    const tag = unique('prod');
    return {
      title: `Ceramic Vase ${tag}`,
      slug: tag,
      description: 'Hand-thrown stoneware vase.',
      currency: 'USD',
      basePriceMinor: '4990',
      media: [{ url: 'https://cdn.agora.test/vase.jpg', alt: 'Vase photo' }],
      attributes: { material: 'stoneware' },
      variants: [
        { sku: `${tag}-sm`, optionValues: { size: 'S' }, priceMinor: '3990', stock: 5 },
        { sku: `${tag}-lg`, optionValues: { size: 'L' }, priceMinor: '5990', stock: 2 },
      ],
      categoryIds: [],
      ...overrides,
    };
  }

  function authOf(seller: Seller): Record<string, string> {
    return { authorization: `Bearer ${seller.token}` };
  }

  it('seeds the starter category set', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/categories' });
    expect(res.statusCode).toBe(200);
    const cats = res.json() as { slug: string; parentId: string | null }[];
    expect(cats.length).toBeGreaterThanOrEqual(10);
    const fashion = cats.find((c) => c.slug === 'fashion');
    expect(fashion).toBeDefined();
    expect(cats.filter((c) => c.parentId === fashion!.id).length).toBeGreaterThanOrEqual(2);
  });

  it('creates a product with variants and categories', async () => {
    const seller = await makeSeller();
    const cats = (await app.inject({ method: 'GET', url: '/v1/categories' })).json() as { id: string }[];
    const payload = productPayload({ categoryIds: [cats[0]!.id, cats[1]!.id] });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/seller/products',
      headers: authOf(seller),
      payload,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { id: string; slug: string };
    expect(body.id).toBeTruthy();

    const row = await prisma.product.findUniqueOrThrow({
      where: { id: body.id },
      include: { variants: true, productCategories: true },
    });
    expect(row.variants).toHaveLength(2);
    expect(row.productCategories).toHaveLength(2);
    expect(row.basePriceMinor).toBe(4990n);
  });

  it('rejects a duplicate slug within the same shop', async () => {
    const seller = await makeSeller();
    const first = productPayload();
    await app.inject({ method: 'POST', url: '/v1/seller/products', headers: authOf(seller), payload: first });

    const dup = await app.inject({
      method: 'POST',
      url: '/v1/seller/products',
      headers: authOf(seller),
      payload: { ...productPayload(), slug: first.slug as string },
    });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.code).toBe('SLUG_TAKEN');
  });

  it('keeps drafts hidden from the public list', async () => {
    const seller = await makeSeller();
    const created = await app.inject({
      method: 'POST',
      url: '/v1/seller/products',
      headers: authOf(seller),
      payload: productPayload(),
    });
    expect(created.statusCode).toBe(201);
    const slug = (created.json() as { slug: string }).slug;

    const list = await app.inject({ method: 'GET', url: '/v1/products' });
    const items = (list.json() as { items: { slug: string }[] }).items;
    expect(items.find((p) => p.slug === slug)).toBeUndefined();

    const detail = await app.inject({ method: 'GET', url: `/v1/products/${slug}` });
    expect(detail.statusCode).toBe(404);
  });

  it('publishes and exposes the product publicly with search + filters', async () => {
    const seller = await makeSeller();
    const payload = productPayload({ basePriceMinor: '2500', attributes: { material: 'linen' } });
    const created = await app.inject({
      method: 'POST',
      url: '/v1/seller/products',
      headers: authOf(seller),
      payload,
    });
    const { id, slug } = created.json() as { id: string; slug: string };

    const pub = await app.inject({
      method: 'POST',
      url: `/v1/seller/products/${id}/publish`,
      headers: authOf(seller),
      payload: {},
    });
    expect(pub.statusCode).toBe(200);
    expect((pub.json() as { status: string }).status).toBe('published');

    const detail = await app.inject({ method: 'GET', url: `/v1/products/${slug}` });
    expect(detail.statusCode).toBe(200);
    const d = detail.json() as {
      title: string;
      basePriceMinor: string;
      variants: { sku: string }[];
      shop: { slug: string } | null;
    };
    expect(d.title).toBe(payload.title);
    expect(d.basePriceMinor).toBe('2500');
    expect(d.variants).toHaveLength(2);
    expect(d.shop?.slug).toBe(seller.slug);

    const search = await app.inject({ method: 'GET', url: `/v1/products?q=${encodeURIComponent(payload.title as string)}` });
    expect((search.json() as { items: { slug: string }[] }).items.map((p) => p.slug)).toContain(slug);

    const byShop = await app.inject({ method: 'GET', url: `/v1/products?shop=${seller.slug}` });
    expect((byShop.json() as { items: { slug: string }[] }).items.map((p) => p.slug)).toContain(slug);

    const noMatch = await app.inject({ method: 'GET', url: '/v1/products?q=zzzznomatch' });
    expect((noMatch.json() as { items: unknown[] }).items).toHaveLength(0);
  });

  it('sorts by price and filters by category', async () => {
    const seller = await makeSeller();
    const cats = (await app.inject({ method: 'GET', url: '/v1/categories' })).json() as { id: string; slug: string }[];
    const target = cats.find((c) => c.slug === 'home-decor')!;

    for (const price of ['9000', '1000']) {
      const payload = productPayload({ basePriceMinor: price, categoryIds: [target.id] });
      await app.inject({
        method: 'POST',
        url: '/v1/seller/products',
        headers: authOf(seller),
        payload,
      });
      await app.inject({
        method: 'POST',
        url: `/v1/seller/products/${(await app.inject({ method: 'GET', url: '/v1/seller/products', headers: authOf(seller) })).json().items[0].id}/publish`,
        headers: authOf(seller),
        payload: {},
      });
    }

    const asc = await app.inject({ method: 'GET', url: `/v1/products?category=${target.slug}&sort=price_asc` });
    const ascPrices = (asc.json() as { items: { basePriceMinor: string }[] }).items.map((p) => Number(p.basePriceMinor));
    expect(ascPrices.length).toBeGreaterThanOrEqual(2);
    expect(ascPrices).toEqual([...ascPrices].sort((a, b) => a - b));
  });

  it('isolates sellers: other sellers cannot read or modify', async () => {
    const sellerA = await makeSeller();
    const sellerB = await makeSeller();
    const created = await app.inject({
      method: 'POST',
      url: '/v1/seller/products',
      headers: authOf(sellerA),
      payload: productPayload(),
    });
    const { id } = created.json() as { id: string };

    const readB = await app.inject({ method: 'GET', url: `/v1/seller/products/${id}`, headers: authOf(sellerB) });
    expect(readB.statusCode).toBe(404);
    const patchB = await app.inject({
      method: 'PATCH',
      url: `/v1/seller/products/${id}`,
      headers: authOf(sellerB),
      payload: { title: 'hacked' },
    });
    expect(patchB.statusCode).toBe(404);
  });

  it('updates fields and replaces variants', async () => {
    const seller = await makeSeller();
    const created = await app.inject({
      method: 'POST',
      url: '/v1/seller/products',
      headers: authOf(seller),
      payload: productPayload(),
    });
    const { id } = created.json() as { id: string };

    const patched = await app.inject({
      method: 'PATCH',
      url: `/v1/seller/products/${id}`,
      headers: authOf(seller),
      payload: {
        title: 'Renamed Vase',
        variants: [{ sku: `${RUN}-new-sku`, optionValues: { size: 'XL' }, priceMinor: '7990', stock: 1 }],
      },
    });
    expect(patched.statusCode).toBe(204);

    const row = await prisma.product.findUniqueOrThrow({ where: { id }, include: { variants: true } });
    expect(row.title).toBe('Renamed Vase');
    expect(row.variants).toHaveLength(1);
    expect(row.variants[0]!.sku).toBe(`${RUN}-new-sku`);
  });

  it('rejects invalid payloads with 422', async () => {
    const seller = await makeSeller();
    const bad = await app.inject({
      method: 'POST',
      url: '/v1/seller/products',
      headers: authOf(seller),
      payload: { ...productPayload(), slug: 'BAD SLUG!', basePriceMinor: '-5' },
    });
    expect(bad.statusCode).toBe(422);
    expect(bad.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unauthenticated seller writes', async () => {
    const res = await app.inject({ method: 'POST', url: '/v1/seller/products', payload: productPayload() });
    expect(res.statusCode).toBe(401);
  });
});
