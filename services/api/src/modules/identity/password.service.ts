import { hash, verify } from '@node-rs/argon2';

/**
 * Password service — Argon2id (ADR-0007). Never store or log plaintext.
 */
export class PasswordService {
  /** Argon2id parameters (OWASP-recommended baseline). */
  private static readonly OPTIONS = {
    memoryCost: 19_456, // 19 MiB
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  };

  async hash(plain: string): Promise<string> {
    return hash(plain, PasswordService.OPTIONS);
  }

  async verify(hashed: string, plain: string): Promise<boolean> {
    try {
      return await verify(hashed, plain, PasswordService.OPTIONS);
    } catch {
      // Malformed hash or incompatible parameters — treat as mismatch.
      return false;
    }
  }

  /**
   * Password policy (enforced in addition to the zod schema length rules):
   *   - 8..128 chars (contract)
   *   - must contain a letter and a number
   * Returns a list of violations (empty = valid).
   */
  validatePolicy(plain: string): string[] {
    const violations: string[] = [];
    if (plain.length < 8 || plain.length > 128) {
      violations.push('Password must be between 8 and 128 characters');
    }
    if (!/[a-zA-Z]/.test(plain)) {
      violations.push('Password must contain at least one letter');
    }
    if (!/\d/.test(plain)) {
      violations.push('Password must contain at least one number');
    }
    return violations;
  }
}

export const passwordService = new PasswordService();
