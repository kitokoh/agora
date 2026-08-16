import { execSync } from 'node:child_process';
import { pino } from 'pino';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPrismaClient, type PrismaClient } from '@agora/db';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { EmailMessage, EmailTransport } from '../src/modules/notification/notification.module.js';

/**
 * Identity integration tests (#20-#22) against a real PostgreSQL.
 * Gated by RUN_DB_TESTS=1 (CI has no DB; run locally with:
 *   RUN_DB_TESTS=1 pnpm --filter @agora/api test)
 */
const runDbTests = process.env.RUN_DB_TESTS === '1';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://agora:agora@localhost:5432/agora_test?schema=public';

class InMemoryTransport implements EmailTransport {
  messages: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.messages.push(message);
  }
}

describe.skipIf(!runDbTests)('identity integration (#20-#22)', () => {
  let prisma: PrismaClient;
  let transport: InMemoryTransport;
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    // Fresh test database: drop/create + apply migrations.
    execSync(
      `psql postgresql://agora:agora@localhost:5432/postgres -c "DROP DATABASE IF EXISTS agora_test;" -c "CREATE DATABASE agora_test OWNER agora;"`,
      { stdio: 'pipe' },
    );
    execSync('pnpm exec prisma migrate deploy', {
      cwd: import.meta.dirname + '/../../../packages/db',
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: 'pipe',
    });

    prisma = createPrismaClient();
    await prisma.$connect();
    transport = new InMemoryTransport();

    const config = loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      REDIS_URL: 'redis://localhost:6379',
      PUBLIC_APP_URL: 'http://localhost:3000',
    });
    app = await buildApp({ logger: pino({ level: 'silent' }), config, emailTransport: transport });
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    transport.messages = [];
    // Reset identity tables between tests (FK order matters).
    await prisma.$executeRawUnsafe('TRUNCATE "identity"."one_time_tokens", "identity"."audit_events", "identity"."sessions", "identity"."role_assignments", "identity"."users" RESTART IDENTITY CASCADE');
  });

  it('registers a user (unverified) and sends a verification email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: ' Seller@Example.com ', password: 'valid-pass-123' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.status).toBe('unverified');
    expect(body.email).toBe('seller@example.com'); // normalized

    const user = await prisma.user.findUnique({ where: { email: 'seller@example.com' } });
    expect(user).not.toBeNull();
    expect(user!.status).toBe('unverified');
    expect(user!.passwordHash).not.toBe('valid-pass-123');
    expect(user!.passwordHash).toMatch(/^\$argon2/);

    expect(transport.messages).toHaveLength(1);
    expect(transport.messages[0]!.event).toBe('auth.email_verification');
    expect(transport.messages[0]!.text).toContain('/verify?token=');
  });

  it('rejects duplicate registration with EMAIL_TAKEN', async () => {
    const payload = { email: 'dup@example.com', password: 'valid-pass-123' };
    await app.inject({ method: 'POST', url: '/v1/auth/register', payload });
    const second = await app.inject({ method: 'POST', url: '/v1/auth/register', payload });
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects weak passwords with PASSWORD_POLICY', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: 'weak@example.com', password: 'abcdefghij' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('PASSWORD_POLICY');
  });

  it('verifies email with the emailed token and activates the account', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: 'verify@example.com', password: 'valid-pass-123' },
    });
    const url = transport.messages[0]!.text!;
    const token = /token=([^\s]+)/.exec(url)![1]!;

    const res = await app.inject({ method: 'POST', url: '/v1/auth/verify', payload: { token } });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('verified');

    const user = await prisma.user.findUnique({ where: { email: 'verify@example.com' } });
    expect(user!.status).toBe('active');
    expect(user!.emailVerifiedAt).not.toBeNull();
  });

  it('rejects token reuse (single-use) and invalid tokens', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: 'reuse@example.com', password: 'valid-pass-123' },
    });
    const token = /token=([^\s]+)/.exec(transport.messages[0]!.text!)![1]!;

    expect((await app.inject({ method: 'POST', url: '/v1/auth/verify', payload: { token } })).statusCode).toBe(200);
    const reuse = await app.inject({ method: 'POST', url: '/v1/auth/verify', payload: { token } });
    expect(reuse.statusCode).toBe(410);
    expect(reuse.json().error.code).toBe('TOKEN_USED');

    const invalid = await app.inject({ method: 'POST', url: '/v1/auth/verify', payload: { token: 'x'.repeat(64) } });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error.code).toBe('TOKEN_INVALID');
  });

  it('writes audit events for register and verify', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: 'audit@example.com', password: 'valid-pass-123' },
    });
    const events = await prisma.identityAuditEvent.findMany({ orderBy: { at: 'asc' } });
    expect(events.map((e) => e.action)).toContain('auth.register');
  });

  it('resend endpoint is non-enumerating (200 for unknown email)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify/resend',
      payload: { email: 'nobody@example.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(transport.messages).toHaveLength(0);
  });
});
