/** MongoDB duplicate-key error (E11000): how unique indexes report a lost race. */
export const isDuplicateKeyError = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;
