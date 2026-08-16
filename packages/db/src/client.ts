import { PrismaClient } from '@prisma/client';

export interface CreatePrismaClientOptions {
  /** Explicit DATABASE_URL override (tests use isolated databases). */
  datasourceUrl?: string;
}

/**
 * Shared PrismaClient for the Agora monorepo.
 * All services use this single client. Tests may pass an explicit
 * `datasourceUrl` to isolate against a dedicated test database.
 */
export function createPrismaClient(options: CreatePrismaClientOptions = {}): PrismaClient {
  return new PrismaClient(
    options.datasourceUrl ? { datasources: { db: { url: options.datasourceUrl } } } : undefined,
  );
}

export const prisma = createPrismaClient();

export type { PrismaClient };
