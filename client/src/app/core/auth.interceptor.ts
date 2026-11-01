import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Runs around every HttpClient request (like Express middleware, but in the browser and on the
 * outgoing side). If any API call returns 401, the session expired: send the user to /login.
 * /api/me is excluded because a 401 there just means "not signed in yet".
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && !req.url.endsWith('/api/me')) {
        auth.markSignedOut();
      }
      return throwError(() => err);
    }),
  );
};
