import { createHmac, timingSafeEqual } from 'node:crypto';

/** GitHub signs the raw request body: X-Hub-Signature-256: sha256=<hex hmac>. */
export const signPayload = (rawBody: Buffer, secret: string): string =>
  `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;

/** Constant-time comparison so the check does not leak how many characters matched. */
export const isValidSignature = (rawBody: Buffer, signature: string | undefined, secret: string): boolean => {
  if (!signature) return false;
  const expected = Buffer.from(signPayload(rawBody, secret));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
};
