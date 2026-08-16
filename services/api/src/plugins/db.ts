import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { createPrismaClient, type PrismaClient } from '@agora/db';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export interface PrismaPluginOptions {
  client?: PrismaClient;
  /** Explicit DATABASE_URL (overrides ambient env/.env — tests use isolated DBs). */
  datasourceUrl?: string;
}

/**
 * Attaches the shared Prisma client to the Fastify instance.
 * Tests may inject a mock or a client pointed at a test database.
 */
export const prismaPlugin = fp(
  async (app: FastifyInstance, options: PrismaPluginOptions): Promise<void> => {
    const client = options.client ?? createPrismaClient({ datasourceUrl: options.datasourceUrl });
    app.decorate('prisma', client);
    app.addHook('onClose', async () => {
      await client.$disconnect();
    });
  },
  { name: 'agora-db' },
);
