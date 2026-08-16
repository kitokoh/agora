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
