import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * UX only: keeps signed-out users from seeing an empty, erroring app shell.
 * Real protection is requireAuth on the server; this guard can be bypassed and that's fine.
 * If the server can't be reached, send the user to /login with an explanation. An errored guard
 * would cancel navigation and leave a blank page with no way out.
 */
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService)
    .loadSession()
    .pipe(
      map((user) => (user ? true : router.createUrlTree(['/login']))),
      catchError(() => of(router.createUrlTree(['/login'], { queryParams: { error: 'server' } }))),
    );
};

/** The reverse: a signed-in user visiting /login goes straight to their Zaps. Server down → still show /login. */
export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService)
    .loadSession()
    .pipe(
      map((user) => (user ? router.createUrlTree(['/zaps']) : true)),
      catchError(() => of(true)),
    );
};
