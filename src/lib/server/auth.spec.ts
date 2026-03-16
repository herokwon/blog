import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './auth';

describe('[Server/Auth] hashPassword', () => {
  it('returns a non-empty base64 string', async () => {
    const hash = await hashPassword('password');

    expect(hash).toBeTypeOf('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('produces a different hash each call due to random salt', async () => {
    const [hash1, hash2] = await Promise.all([
      hashPassword('password'),
      hashPassword('password'),
    ]);

    expect(hash1).not.toBe(hash2);
  });
});

describe('[Server/Auth] verifyPassword', () => {
  it('returns true for the correct password', async () => {
    const hash = await hashPassword('correct');
    expect(await verifyPassword('correct', hash)).toBe(true);
  });

  it('returns false for an incorrect password', async () => {
    const hash = await hashPassword('correct');
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('returns false for a tampered hash', async () => {
    const hash = await hashPassword('password');
    const tampered = hash.slice(0, -4) + 'AAAA';

    expect(await verifyPassword('password', tampered)).toBe(false);
  });
});
