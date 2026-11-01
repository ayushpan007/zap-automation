import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './crypto.js';

describe('token encryption', () => {
  const key = Buffer.alloc(32, 1);

  it('round-trips and uses a fresh IV each time', () => {
    const a = encryptSecret('gho_abc', key);
    expect(decryptSecret(a, key)).toBe('gho_abc');
    expect(encryptSecret('gho_abc', key)).not.toBe(a);
  });

  it('fails loudly with the wrong key', () => {
    expect(() => decryptSecret(encryptSecret('gho_abc', key), Buffer.alloc(32, 2))).toThrow();
  });

  it('rejects malformed payloads, including a truncated auth tag', () => {
    const [iv, tag, ciphertext] = encryptSecret('gho_abc', key).split('.') as [string, string, string];
    const shortTag = Buffer.from(tag, 'base64').subarray(0, 4).toString('base64');
    expect(() => decryptSecret(`${iv}.${shortTag}.${ciphertext}`, key)).toThrow('Malformed');
    expect(() => decryptSecret(`${iv}..${ciphertext}`, key)).toThrow('Malformed');
    expect(() => decryptSecret('garbage', key)).toThrow('Malformed');
  });
});
