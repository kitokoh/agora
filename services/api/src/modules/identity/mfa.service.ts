import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { authenticator } from 'otplib';
import type { PrismaClient } from '@agora/db';
import { ApiError } from '../../plugins/error-handler.js';

/**
 * MFA service — TOTP (RFC 6238) via otplib + recovery codes.
 *
 * Secrets are AES-256-GCM encrypted at rest (key from MFA_ENCRYPTION_KEY;
 * dev fallback derived from the JWT private key material). Recovery codes
 * are stored as sha256 hashes, single-use.
 */
export class MfaService {
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly prisma: PrismaClient,
    encryptionKey: string,
    private readonly issuer = 'Agora',
  ) {
    if (encryptionKey.length < 16) {
      throw new Error('MFA_ENCRYPTION_KEY must be at least 16 characters');
    }
    this.encryptionKey = createHash('sha256').update(encryptionKey).digest();
  }

  // -- secret management ---------------------------------------------------

  generateSecret(): { secret: string; otpauthUrl: string } {
    const secret = authenticator.generateSecret();
    return { secret, otpauthUrl: this.buildOtpauthUrl(secret, '') };
  }

  private buildOtpauthUrl(secret: string, account: string): string {
    return authenticator.keyuri(account || 'user', this.issuer, secret);
  }

  private encrypt(secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
  }

  private decrypt(payload: string): string {
    const [ivB64, tagB64, dataB64] = payload.split('.');
    if (!ivB64 || !tagB64 || !dataB64) throw new ApiError(500, 'MFA_SECRET_CORRUPT', 'Stored MFA secret is corrupt');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()]).toString('utf8');
  }

  // -- enrollment ----------------------------------------------------------

  async enable(userId: string, secret: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecretEnc: this.encrypt(secret), mfaEnabled: true },
    });
  }

  async disable(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecretEnc: null, mfaEnabled: false, mfaBackupCodes: undefined },
    });
  }

  // -- verification --------------------------------------------------------

  verifyCode(userId: string, secretEnc: string | null, code: string): boolean {
    if (!secretEnc) throw new ApiError(400, 'MFA_NOT_ENABLED', 'MFA is not enabled for this account');
    return MfaService.verifySecret(this.decrypt(secretEnc), code);
  }

  /** Verify a TOTP code against a RAW (unencrypted) secret. */
  static verifySecret(secret: string, code: string): boolean {
    try {
      return authenticator.verify({ token: code, secret });
    } catch {
      return false;
    }
  }

  // -- recovery codes ------------------------------------------------------

  static hashRecoveryCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  generateRecoveryCodes(count = 10): { plain: string[]; hashed: string[] } {
    const plain = Array.from({ length: count }, () => {
      // 6 bytes -> 8 base64url chars; stripping URL-safe chars leaves >= 6.
      const bytes = randomBytes(6);
      return bytes.toString('base64url').replace(/[-_]/g, '').slice(0, 8).toUpperCase();
    });
    return { plain, hashed: plain.map(MfaService.hashRecoveryCode) };
  }

  async storeRecoveryCodes(userId: string, hashed: string[]): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaBackupCodes: hashed },
    });
  }

  /** Consume one recovery code (single-use, hashed compare). */
  async consumeRecoveryCode(userId: string, plainCode: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const stored = (user?.mfaBackupCodes as string[] | null) ?? [];
    const hashed = MfaService.hashRecoveryCode(plainCode.trim().toUpperCase());
    const index = stored.findIndex((h) => {
      try {
        const a = Buffer.from(h, 'hex');
        const b = Buffer.from(hashed, 'hex');
        return a.length === b.length && timingSafeEqual(a, b);
      } catch {
        return false;
      }
    });
    if (index === -1) return false;
    const remaining = stored.filter((_, i) => i !== index);
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaBackupCodes: remaining },
    });
    return true;
  }
}
