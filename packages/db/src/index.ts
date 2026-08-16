export { prisma, createPrismaClient } from './client.js';
export type { PrismaClient } from './client.js';
// Re-export the generated client surface (Prisma namespace, model types,
// enum types/values) so consumers import everything from '@agora/db'.
export * from '@prisma/client';
