import { PrismaClient } from '@prisma/client';

/**
 * Shared PrismaClient for the Agora monorepo.
 *
 * All services use this single client. In tests, construct your own
 * client with an isolated DATABASE_URL or a mocked transaction.
 */
export function createPrismaClient(): PrismaClient {
  return new PrismaClient();
}

export const prisma = createPrismaClient();

export type { PrismaClient };
