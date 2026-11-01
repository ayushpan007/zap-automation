import { describe, expect, it } from 'vitest';
import { isValidSignature, signPayload } from './webhook.signature.js';

describe('webhook signature', () => {
  const body = Buffer.from('{"hello":"world"}');

  it('accepts a correct signature', () => {
    expect(isValidSignature(body, signPayload(body, 's3cret'), 's3cret')).toBe(true);
  });

  it('rejects a wrong secret, a tampered body, and a missing header', () => {
    expect(isValidSignature(body, signPayload(body, 'other'), 's3cret')).toBe(false);
    expect(isValidSignature(Buffer.from('{"hello":"evil"}'), signPayload(body, 's3cret'), 's3cret')).toBe(false);
    expect(isValidSignature(body, undefined, 's3cret')).toBe(false);
  });
});
