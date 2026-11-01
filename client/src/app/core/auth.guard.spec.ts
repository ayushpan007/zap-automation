import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { firstValueFrom, type Observable } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  const run = () =>
    firstValueFrom(
      TestBed.runInInjectionContext(
        () => authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot) as Observable<boolean | UrlTree>,
      ),
    );

  it('redirects to /login when the server says 401', async () => {
    const result = run();
    http.expectOne('/api/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    const tree = (await result) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(tree)).toBe('/login');
  });

  it('treats a 404 (cookie for a deleted user) as signed out', async () => {
    const result = run();
    http.expectOne('/api/me').flush({}, { status: 404, statusText: 'Not Found' });
    expect(TestBed.inject(Router).serializeUrl((await result) as UrlTree)).toBe('/login');
  });

  // Regression: an errored guard cancelled navigation and left a blank page.
  it('sends the user to /login with an explanation when the server is unreachable, and retries next time', async () => {
    const result = run();
    http.expectOne('/api/me').flush({}, { status: 502, statusText: 'Bad Gateway' });
    expect(TestBed.inject(Router).serializeUrl((await result) as UrlTree)).toBe('/login?error=server');

    const retry = run();
    http.expectOne('/api/me').flush({ id: '1', login: 'octo', name: null, avatarUrl: '' });
    expect(await retry).toBe(true);
  });

  it('allows navigation when a session exists, and caches it', async () => {
    const first = run();
    http.expectOne('/api/me').flush({ id: '1', login: 'octo', name: null, avatarUrl: '' });
    expect(await first).toBe(true);
    expect(await run()).toBe(true);
    http.expectNone('/api/me');
  });
});
