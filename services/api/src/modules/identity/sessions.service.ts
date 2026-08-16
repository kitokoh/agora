import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify, generateKeyPair, importPKCS8, importSPKI } from 'jose';
type KeyPair = Awaited<ReturnType<typeof generateKeyPair>>;
import type { PrismaClient } from '@agora/db';
import type { AppConfig } from '../../config.js';
import { ApiError } from '../../plugins/error-handler.js';
import { type AuditService } from './audit.service.js';

export interface SessionContext {
  ip?: string;
  ua?: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  user: { id: string; email: string; mfaRequired: boolean; roles: string[] };
}

export interface AccessTokenClaims {
  sub: string;
  email: string;
  roles: string[];
  shopIds: string[];
  sessionId: string;
}

const ACCESS_TOKEN_TYPE = 'access';

/**
 * Session service (ADR-0007):
 *   - Access tokens: RS256 JWT, short TTL (default 15 min)
 *   - Refresh tokens: opaque, 256-bit, sha256-hashed at rest, 30 d TTL
 *   - Rotation: every refresh issues a new refresh token; a session family
 *     is one device. Reuse of an already-rotated token revokes the family.
 */
export class SessionService {
  private readonly accessTtlSeconds: number;

  private readonly idleTtlDays: number;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: AppConfig,
    private readonly audit: AuditService,
    private readonly keyPair: KeyPair,
  ) {
    this.idleTtlDays = config.JWT_REFRESH_IDLE_TTL_DAYS ?? 7;
    const parsed = /^(\d+)([smhd])$/.exec(config.JWT_ACCESS_TTL);
    const ttl = parsed?.[1];
    const unit = parsed?.[2];
    if (!ttl || !unit) throw new Error(`Invalid JWT_ACCESS_TTL: ${config.JWT_ACCESS_TTL}`);
    const unitSeconds: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    this.accessTtlSeconds = Number(ttl) * (unitSeconds[unit] ?? 1);
  }

  static async generateKeyPair(): Promise<KeyPair> {
    return generateKeyPair('RS256', { extractable: true });
  }

  /** Create a session row + return the raw refresh token. */
  private async createSession(
    userId: string,
    familyId: string,
    ctx: SessionContext,
  ): Promise<string> {
    const raw = randomBytes(48).toString('base64url');
    await this.prisma.session.create({
      data: {
        userId,
        familyId,
        refreshTokenHash: SessionService.hash(raw),
        ip: ctx.ip,
        userAgent: ctx.ua,
        expiresAt: new Date(
          Date.now() + this.config.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
        ),
        lastUsedAt: new Date(),
      },
    });
    return raw;
  }

  async issueTokens(
    userId: string,
    email: string,
    roles: string[],
    shopIds: string[],
    ctx: SessionContext,
  ): Promise<LoginResult> {
    const familyId = randomBytes(16).toString('hex');
    const sessionId = randomBytes(16).toString('hex');
    const refreshToken = await this.createSession(userId, familyId, ctx);

    const accessToken = await this.signAccessToken({
      sub: userId,
      email,
      roles,
      shopIds,
      sessionId,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTtlSeconds,
      tokenType: 'Bearer',
      user: { id: userId, email, mfaRequired: false, roles },
    };
  }

  async signAccessToken(claims: AccessTokenClaims): Promise<string> {
    return new SignJWT({ ...claims, typ: ACCESS_TOKEN_TYPE })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject(claims.sub)
      .setIssuedAt()
      .setIssuer('agora-api')
      .setAudience('agora-clients')
      .setExpirationTime(`${this.accessTtlSeconds}s`)
      .sign(this.keyPair.privateKey);
  }

  /** Verify an access token; returns claims or throws 401. */
  /**
   * Short-lived challenge token issued at login when MFA is enabled.
   * Verified in the MFA step (#26); 2-minute TTL.
   */
  async signMfaChallenge(userId: string, _email: string): Promise<string> {
    return new SignJWT({ typ: 'mfa-challenge' })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setIssuer('agora-api')
      .setAudience('agora-clients')
      .setExpirationTime(`${this.config.MFA_CHALLENGE_TTL_SECONDS}s`)
      .sign(this.keyPair.privateKey);
  }

  /** Verify a short-lived MFA challenge token (issued at login). */
  async verifyMfaChallenge(challenge: string): Promise<{ userId: string; email: string }> {
    try {
      const { payload } = await jwtVerify(challenge, this.keyPair.publicKey, {
        issuer: 'agora-api',
        audience: 'agora-clients',
        algorithms: ['RS256'],
      });
      if (payload.typ !== 'mfa-challenge' || !payload.sub) throw new Error('not a challenge');
      return { userId: payload.sub, email: (payload.email as string) ?? '' };
    } catch {
      throw new ApiError(401, 'MFA_CHALLENGE_INVALID', 'MFA challenge is invalid or expired');
    }
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    try {
      const { payload } = await jwtVerify(token, this.keyPair.publicKey, {
        issuer: 'agora-api',
        audience: 'agora-clients',
        algorithms: ['RS256'],
      });
      if (payload.typ !== ACCESS_TOKEN_TYPE) throw new Error('wrong token type');
      return payload as unknown as AccessTokenClaims;
    } catch {
      throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired access token');
    }
  }

  /**
   * Rotate a refresh token. Returns the new token pair.
   * Reuse of a rotated token revokes the entire session family.
   */
  async rotateRefreshToken(rawRefresh: string, ctx: SessionContext): Promise<LoginResult> {
    const hash = SessionService.hash(rawRefresh);
    const session = await this.prisma.session.findUnique({ where: { refreshTokenHash: hash } });

    if (!session) {
      throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid');
    }
    if (session.revokedAt) {
      // A revoked (already-rotated) token signals reuse — kill the family.
      await this.prisma.session.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new ApiError(401, 'REFRESH_TOKEN_REUSED', 'Session has been revoked for security');
    }
    if (session.expiresAt < new Date()) {
      throw new ApiError(401, 'REFRESH_TOKEN_EXPIRED', 'Refresh token has expired');
    }
    if (session.lastUsedAt && Date.now() - session.lastUsedAt.getTime() > this.idleTtlDays * 24 * 60 * 60 * 1000) {
      throw new ApiError(401, 'REFRESH_TOKEN_EXPIRED', 'Session expired due to inactivity');
    }

    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || user.status === 'deleted') {
      throw new ApiError(401, 'UNAUTHORIZED', 'Account is unavailable');
    }
    if (user.status === 'suspended') {
      throw new ApiError(403, 'ACCOUNT_SUSPENDED', 'Account is suspended');
    }

    // Rotate: mark old session consumed, create the new one in the same family.
    const rotated = await this.prisma.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (rotated.count !== 1) {
      // Reuse detected — the old token was already rotated. Revoke family.
      await this.prisma.session.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(
        { actorType: 'user', actorId: user.id, ip: ctx.ip, ua: ctx.ua },
        'auth.refresh_reuse_detected',
        'session',
        session.familyId,
      );
      throw new ApiError(401, 'REFRESH_TOKEN_REUSED', 'Session has been revoked for security');
    }

    const roles = await this.loadRoles(user.id);
    const newRefresh = await this.createSession(user.id, session.familyId, ctx);
    const accessToken = await this.signAccessToken({
      sub: user.id,
      email: user.email,
      roles,
      shopIds: await this.loadShopIds(user.id),
      sessionId: randomBytes(16).toString('hex'),
    });

    return {
      accessToken,
      refreshToken: newRefresh,
      expiresIn: this.accessTtlSeconds,
      tokenType: 'Bearer',
      user: { id: user.id, email: user.email, mfaRequired: user.mfaEnabled, roles },
    };
  }

  /** Revoke a single session (logout) or an entire family (device revocation). */
  async revokeSession(rawRefresh: string | undefined, familyId: string | undefined): Promise<void> {
    if (rawRefresh) {
      const hash = SessionService.hash(rawRefresh);
      await this.prisma.session.updateMany({
        where: { refreshTokenHash: hash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return;
    }
    if (familyId) {
      await this.prisma.session.updateMany({
        where: { familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  async revokeFamilyBySessionId(sessionId: string): Promise<void> {
    const session = await this.prisma.session.findFirst({ where: { id: sessionId } });
    if (!session) return;
    await this.prisma.session.updateMany({
      where: { familyId: session.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async loadRoles(userId: string): Promise<string[]> {
    const assignments = await this.prisma.roleAssignment.findMany({
      where: { userId },
      include: { role: true },
    });
    return assignments.map((a) => a.role.name);
  }

  async loadShopIds(userId: string): Promise<string[]> {
    const assignments = await this.prisma.roleAssignment.findMany({
      where: { userId, shopId: { not: null } },
      select: { shopId: true },
    });
    return assignments.map((a) => a.shopId as string);
  }

  static hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}

export async function loadKeyPair(config: AppConfig): Promise<KeyPair> {
  if (config.JWT_PRIVATE_KEY && config.JWT_PUBLIC_KEY) {
    const privateKey = await importPKCS8(config.JWT_PRIVATE_KEY, 'RS256');
    const publicKey = await importSPKI(config.JWT_PUBLIC_KEY, 'RS256');
    return { privateKey, publicKey };
  }
  // Development fallback: in-memory key pair (sessions invalidate on restart).
  return SessionService.generateKeyPair();
}
