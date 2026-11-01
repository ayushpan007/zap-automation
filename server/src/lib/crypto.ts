import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM for GitHub access tokens at rest. A database leak alone then does not leak
 * tokens that can write to users' repositories. Format: base64(iv).base64(authTag).base64(ciphertext)
 */
export const encryptSecret = (plaintext: string, key: Buffer): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((b) => b.toString('base64')).join('.');
};

export const decryptSecret = (payload: string, key: Buffer): string => {
  const parts = payload.split('.').map((part) => Buffer.from(part, 'base64'));
  const [iv, tag, ciphertext] = parts;
  // Buffers are always truthy, so check lengths; a 16-byte tag stops truncated-tag forgeries.
  if (parts.length !== 3 || iv?.length !== 12 || tag?.length !== 16 || !ciphertext?.length) {
    throw new Error('Malformed encrypted secret');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
};
