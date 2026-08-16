import { z } from 'zod';

/**
 * Runtime configuration, validated from environment variables with zod.
 * Every value has a safe local default; production overrides come from
 * AWS Secrets Manager / env (see docs/security.md).
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  APP_ENV: z.string().default('local'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z
    .string()
    .default('postgresql://agora:agora@localhost:5432/agora?schema=public'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  /** Comma-separated CORS allowlist. Empty string = same-origin only. */
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001,http://localhost:3002'),
  /** Global rate limit: requests per minute per IP. */
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  /** Public web app base URL (used in verification/reset email links). */
  PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  /** RS256 key pair for access tokens (ADR-0007). Dev fallback: auto-generated in-memory. */
  JWT_PRIVATE_KEY: z.string().optional(),
  JWT_PUBLIC_KEY: z.string().optional(),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  /** MFA challenge TTL in seconds (issued at login when MFA is enabled). */
  MFA_CHALLENGE_TTL_SECONDS: z.coerce.number().int().positive().default(120),
  /** AES-256 key material for MFA secret encryption at rest (min 16 chars). */
  MFA_ENCRYPTION_KEY: z.string().min(16).default('agora-dev-mfa-key-change-me'),
  /** Enable the /v1/internal/e2e/* test hooks (dev/staging only; production default false). */
  E2E_TOKEN_HOOK: z.preprocess((v) => (v === undefined ? false : v === 'true' || v === true), z.boolean()).default(false),
  /** Auto-approve seller KYC+shops in non-production environments. */
  AUTO_APPROVE_SHOPS: z.preprocess((v) => (v === undefined ? true : v === 'true' || v === true), z.boolean()),
});

export type AppConfig = z.infer<typeof envSchema>;

export class ConfigError extends Error {
  constructor(issues: z.ZodIssue[]) {
    super(`Invalid environment configuration:\n${issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')}`);
    this.name = 'ConfigError';
  }
}

/** Parse and validate the process environment. Throws {@link ConfigError} on invalid input. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(parsed.error.issues);
  }
  return parsed.data;
}
