import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, of, tap, type Observable } from 'rxjs';
import type { User } from './api.types';

/**
 * Holds "who is signed in" for the whole browser tab. The session itself is an httpOnly cookie
 * the browser sends automatically; Angular can't read it, so it asks GET /api/me instead.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  /** undefined = not checked yet, null = signed out. A signal so templates update automatically. */
  private readonly userState = signal<User | null | undefined>(undefined);
  readonly user = this.userState.asReadonly();

  /**
   * Resolves the session once per page load; later calls reuse the cached answer.
   * 401 = no session; 404 = valid cookie for a user that no longer exists. Both mean "signed out".
   * Other errors (server down) are re-thrown and not cached, so the next navigation retries.
   */
  loadSession(): Observable<User | null> {
    const known = this.userState();
    if (known !== undefined) return of(known);
    return this.http.get<User>('/api/me').pipe(
      catchError((err: unknown) => {
        if (err instanceof HttpErrorResponse && (err.status === 401 || err.status === 404)) return of(null);
        throw err;
      }),
      tap((user) => this.userState.set(user)),
    );
  }

  /** Full-page navigation on purpose: OAuth must leave the SPA and go through the server and GitHub. */
  signIn(): void {
    window.location.assign('/auth/github');
  }

  signOut(): Observable<void> {
    return this.http.post<void>('/auth/logout', {}).pipe(
      map(() => undefined),
      tap(() => this.markSignedOut()),
    );
  }

  /** Called when the server says the session is gone (expired cookie, logged out elsewhere). */
  markSignedOut(): void {
    this.userState.set(null);
    void this.router.navigate(['/login']);
  }
}
