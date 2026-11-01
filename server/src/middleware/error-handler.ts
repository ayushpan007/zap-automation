import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';

type ErrorBody = { error: { code: string; message: string; details?: unknown } };

/** Pure: every error becomes the same response shape. Unknown errors never leak internals to clients. */
export const toErrorResponse = (err: unknown): { status: number; body: ErrorBody } => {
  // GitHub failures carry the API path and response body in their message: log it, don't send it.
  if (err instanceof AppError && err.code === 'UPSTREAM_FAILED') {
    return { status: err.status, body: { error: { code: err.code, message: 'GitHub request failed. Try again in a moment.' } } };
  }
  if (err instanceof AppError) {
    return { status: err.status, body: { error: { code: err.code, message: err.message, details: err.details } } };
  }
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ path: i.path.map(String), message: i.message }));
    return { status: 400, body: { error: { code: 'VALIDATION_FAILED', message: details[0]?.message ?? 'Invalid request', details } } };
  }
  // body-parser marks malformed JSON with status 400 and type 'entity.parse.failed'.
  if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.parse.failed') {
    return { status: 400, body: { error: { code: 'BAD_REQUEST', message: 'Malformed JSON body' } } };
  }
  return { status: 500, body: { error: { code: 'INTERNAL', message: 'Something went wrong' } } };
};

// Express 5 forwards rejected promises from async handlers here automatically — no try/catch wrappers needed.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const { status, body } = toErrorResponse(err);
  if (status >= 500) console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  res.status(status).json(body);
};

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
};
