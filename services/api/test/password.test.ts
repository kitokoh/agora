import { describe, expect, it } from 'vitest';
import { PasswordService } from '../src/modules/identity/password.service.js';

const svc = new PasswordService();

describe('PasswordService (Argon2id)', () => {
  it('hashes and verifies a password', async () => {
    const hashed = await svc.hash('correct-horse-battery-1');
    expect(hashed).not.toContain('correct-horse');
    expect(await svc.verify(hashed, 'correct-horse-battery-1')).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hashed = await svc.hash('correct-horse-battery-1');
    expect(await svc.verify(hashed, 'wrong-password')).toBe(false);
  });

  it('produces unique hashes per password (salting)', async () => {
    const a = await svc.hash('same-password-123');
    const b = await svc.hash('same-password-123');
    expect(a).not.toBe(b);
  });

  it('handles malformed stored hashes gracefully', async () => {
    expect(await svc.verify('not-a-valid-hash', 'anything')).toBe(false);
  });

  it('enforces the password policy', () => {
    expect(svc.validatePolicy('Short1!')).not.toEqual([]); // < 8 chars
    expect(svc.validatePolicy('no numbers here')).not.toEqual([]);
    expect(svc.validatePolicy('12345678')).not.toEqual([]);
    expect(svc.validatePolicy('valid-pass-123')).toEqual([]);
  });
});
