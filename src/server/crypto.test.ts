import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, maskSecret } from './crypto';

const key = randomBytes(32);

describe('crypto', () => {
  it('round-trips a secret with an explicit key', () => {
    const secret = 'sk-ant-abc123';
    const ciphertext = encryptSecret(secret, key);
    expect(ciphertext).not.toContain(secret);
    expect(decryptSecret(ciphertext, key)).toBe(secret);
  });

  it('produces a fresh IV each time (ciphertext is non-deterministic)', () => {
    expect(encryptSecret('same', key)).not.toBe(encryptSecret('same', key));
  });

  it('fails authentication when decrypted with the wrong key', () => {
    const ciphertext = encryptSecret('secret', key);
    expect(() => decryptSecret(ciphertext, randomBytes(32))).toThrow();
  });

  it('rejects malformed ciphertext', () => {
    expect(() => decryptSecret('not-valid', key)).toThrow('Malformed ciphertext');
  });

  it('rejects a key that is not 32 bytes', () => {
    expect(() => encryptSecret('x', randomBytes(16))).toThrow('32 bytes');
  });

  it('reads ENCRYPTION_KEY from the environment when no key is passed', () => {
    const prev = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64');
    try {
      const ciphertext = encryptSecret('env-secret');
      expect(decryptSecret(ciphertext)).toBe('env-secret');
    } finally {
      process.env.ENCRYPTION_KEY = prev;
    }
  });

  it('masks a secret to its last four characters', () => {
    expect(maskSecret('sk-ant-1234')).toBe('••••••••1234');
  });
});
