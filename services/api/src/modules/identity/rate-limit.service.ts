import { type Redis } from 'ioredis';
import type { AuditService } from './audit.service.js';
import { ApiError } from '../../plugins/error-handler.js';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class LockedError extends ApiError {
  constructor(retryAfterSeconds: number) {
    super(
      423,
      'ACCOUNT_LOCKED',
      `Too many failed attempts — try again in ${Math.max(1, Math.ceil(retryAfterSeconds / 60))} minutes`,
    );
    this.retryAfterSeconds = retryAfterSeconds;
  }

  readonly retryAfterSeconds: number;
}

const BUCKET_SUFFIX = ':bucket';
const LOCK_SUFFIX = ':lock';

/**
 * Redis-backed rate limiting + account lockout (issue #24).
 *
 * - Token bucket per (scope, key) — e.g. `auth:login:email:x`, `auth:register:ip:y`.
 * - Lockout: `maxFailures` consecutive failures within `windowSeconds`
 *   set a lock key for the rest of the window; further attempts get
 *   423 ACCOUNT_LOCKED. A successful action clears bucket + lock.
 * - Every lockout emits an `auth.login-anomaly` audit event.
 */
export class AuthRateLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly audit: AuditService,
  ) {}

  private bucketKey(scope: string, value: string): string {
    return `auth:${scope}:${value}${BUCKET_SUFFIX}`;
  }

  private lockKey(scope: string, value: string): string {
    return `auth:${scope}:${value}${LOCK_SUFFIX}`;
  }

  /** Enforce pre-action limits: throws 423 when locked, 429 when over budget. */
  async assertAllowed(scope: string, value: string, limit: number, windowSeconds: number): Promise<void> {
    const lockTtl = await this.redis.ttl(this.lockKey(scope, value));
    if (lockTtl > 0) {
      throw new LockedError(lockTtl);
    }

    const bucket = this.bucketKey(scope, value);
    const current = await this.redis.incr(bucket);
    if (current === 1) {
      await this.redis.expire(bucket, windowSeconds);
    }
    if (current > limit) {
      const ttl = await this.redis.ttl(bucket);
      throw new ApiError(
        429,
        'RATE_LIMITED',
        `Too many attempts — retry in ${Math.max(1, Math.ceil(ttl / 60))} minute(s)`,
        { scope, retryAfterSeconds: ttl },
      );
    }
  }

  /**
   * Record a failed attempt. At `maxFailures` within `windowSeconds`,
   * locks the key for the remaining window and emits the anomaly audit.
   */
  async recordFailure(
    scope: string,
    value: string,
    maxFailures: number,
    windowSeconds: number,
    ctx: { actorId?: string; ip?: string; ua?: string },
  ): Promise<void> {
    const bucket = this.bucketKey(scope, value);
    const attempts = await this.redis.incr(bucket);
    if (attempts === 1) {
      await this.redis.expire(bucket, windowSeconds);
    }
    if (attempts >= maxFailures) {
      const ttl = await this.redis.ttl(bucket);
      await this.redis.set(this.lockKey(scope, value), '1', 'EX', Math.max(1, ttl));
      await this.audit.record(
        { actorType: 'user', actorId: ctx.actorId, ip: ctx.ip, ua: ctx.ua },
        'auth.login-anomaly',
        'user',
        ctx.actorId,
        { scope, value, attempts, lockoutSeconds: ttl },
      );
    }
  }

  /** Clear bucket + lock (successful login, password change, verify). */
  async reset(scope: string, value: string): Promise<void> {
    await this.redis.del(this.bucketKey(scope, value), this.lockKey(scope, value));
  }
}
