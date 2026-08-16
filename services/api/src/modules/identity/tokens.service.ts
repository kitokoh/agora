import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient, TokenPurpose } from '@agora/db';
import { ApiError } from '../../plugins/error-handler.js';

export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 h
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 h

/**
 * One-time token service (email verification, password reset).
 *
 * The raw token is returned exactly once (to the caller, who emails it);
 * only a sha256 hash is persisted. Verification is single-use and
 * expiry-checked atomically.
 */
export class OneTimeTokenService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Create a token and return the RAW value (displayed to the user). */
  async create(userId: string, purpose: TokenPurpose, ttlMs: number): Promise<string> {
    const raw = randomBytes(32).toString('base64url');
    await this.prisma.oneTimeToken.create({
      data: {
        userId,
        purpose,
        tokenHash: OneTimeTokenService.hash(raw),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });
    return raw;
  }

  /**
   * Consume a raw token. Succeeds once; a reused or expired token throws
   * 400 TOKEN_INVALID / 410 TOKEN_EXPIRED. Never reveals validity for a
   * different purpose.
   */
  async consume(raw: string, purpose: TokenPurpose): Promise<string> {
    const tokenHash = OneTimeTokenService.hash(raw);
    const record = await this.prisma.oneTimeToken.findFirst({
      where: { tokenHash, purpose },
    });
    if (!record) {
      throw new ApiError(400, 'TOKEN_INVALID', 'Token is invalid');
    }
    if (record.usedAt) {
      throw new ApiError(410, 'TOKEN_USED', 'Token has already been used');
    }
    if (record.expiresAt < new Date()) {
      throw new ApiError(410, 'TOKEN_EXPIRED', 'Token has expired');
    }

    // Atomic single-use: only one consumer wins the update.
    const consumed = await this.prisma.oneTimeToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) {
      throw new ApiError(410, 'TOKEN_USED', 'Token has already been used');
    }
    return record.userId;
  }

  static hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
