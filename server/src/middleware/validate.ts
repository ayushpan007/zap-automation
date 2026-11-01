import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

/** Express middleware: parse req.body with a Zod schema, replacing it with the typed, normalized result. */
export const validateBody =
  (schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(result.error);
    req.body = result.data;
    next();
  };
