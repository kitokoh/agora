import { type Prisma, type PrismaClient } from '@agora/db';

export interface AuditContext {
  actorType: 'user' | 'staff' | 'system';
  actorId?: string;
  ip?: string;
  ua?: string;
}

/**
 * Identity audit service (FR-008). Append-only; never updated or deleted.
 * Every auth/admin action writes an event; the platform-wide audit schema
 * (M5) can read from the same stream.
 */
export class AuditService {
  constructor(private readonly prisma: PrismaClient) {}

  async record(
    ctx: AuditContext,
    action: string,
    resourceType?: string,
    resourceId?: string,
    diff: Record<string, unknown> = {},
  ): Promise<void> {
    await this.prisma.identityAuditEvent.create({
      data: {
        actorType: ctx.actorType,
        actorId: ctx.actorId,
        action,
        resourceType,
        resourceId,
        diff: diff as Prisma.InputJsonValue,
        ip: ctx.ip,
        ua: ctx.ua,
      },
    });
  }
}
