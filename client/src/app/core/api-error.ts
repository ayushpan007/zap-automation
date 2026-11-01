import { HttpErrorResponse } from '@angular/common/http';
import type { ApiErrorBody } from './api.types';

/** Pure: a human-readable message from any HTTP failure, using the server's error shape when present. */
export const apiErrorMessage = (err: unknown, fallback = 'Something went wrong. Please try again.'): string => {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Cannot reach the server. Is it running?';
    const body = err.error as Partial<ApiErrorBody> | null;
    if (body?.error?.message) return body.error.message;
  }
  return fallback;
};

/** Pure: field-level messages keyed by dotted path, e.g. { 'action.body': 'Unknown field: {{x}}' }. */
export const apiFieldErrors = (err: unknown): Record<string, string> => {
  if (!(err instanceof HttpErrorResponse)) return {};
  const details = (err.error as Partial<ApiErrorBody> | null)?.error?.details ?? [];
  return Object.fromEntries(details.map((d) => [d.path.join('.'), d.message]));
};
