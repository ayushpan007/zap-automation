import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Zap } from '../../core/api.types';
import { ZapListPage } from './zap-list.page';

const zap: Zap = {
  id: 'z1',
  name: 'Thank authors',
  enabled: false,
  trigger: { app: 'github', event: 'pull_request.opened', repo: { id: 1, fullName: 'octo/demo' } },
  action: { app: 'github', type: 'pull_request.comment', body: 'Thanks' },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('ZapListPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  const render = async () => {
    const fixture = TestBed.createComponent(ZapListPage);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  };

  it('shows loading, then the empty state', async () => {
    const { fixture, el } = await render();
    expect(el.textContent).toContain('Loading your Zaps');
    http.expectOne('/api/zaps').flush({ zaps: [] });
    await fixture.whenStable();
    expect(el.textContent).toContain('No Zaps yet');
  });

  it('shows an error state with retry', async () => {
    const { fixture, el } = await render();
    http.expectOne('/api/zaps').flush({}, { status: 500, statusText: 'err' });
    await fixture.whenStable();
    expect(el.textContent).toContain("couldn't be loaded");
    (el.querySelector('.placeholder button') as HTMLButtonElement).click();
    http.expectOne('/api/zaps').flush({ zaps: [zap] });
    await fixture.whenStable();
    expect(el.textContent).toContain('Thank authors');
  });

  it('keeps the switch off and explains why when turning on fails', async () => {
    const { fixture, el } = await render();
    http.expectOne('/api/zaps').flush({ zaps: [zap] });
    await fixture.whenStable();

    const box = el.querySelector('input[role="switch"]') as HTMLInputElement;
    box.click();
    const req = http.expectOne('/api/zaps/z1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ enabled: true });
    req.flush({ error: { code: 'FORBIDDEN', message: 'You need admin access to octo/demo' } }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();

    expect(box.checked).toBe(false);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('You need admin access to octo/demo');
  });
});
