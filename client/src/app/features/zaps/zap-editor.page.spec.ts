import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AppDef } from '../../core/api.types';
import { ZapEditorPage } from './zap-editor.page';

const github: AppDef = {
  key: 'github',
  name: 'GitHub',
  category: 'Code',
  available: true,
  triggers: [
    {
      key: 'pull_request.opened',
      name: 'Pull request opened',
      description: 'Runs when a PR is opened',
      fields: [
        { path: 'pr.title', label: 'PR title', example: 'Fix typo' },
        { path: 'pr.author', label: 'PR author', example: 'octocat' },
      ],
    },
  ],
  actions: [{ key: 'pull_request.comment', name: 'Comment on pull request', description: 'Posts a comment' }],
};

describe('ZapEditorPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  // Regression: the body validator ran during form construction before fieldPaths existed,
  // so the page threw on creation and /zaps/new rendered blank.
  it('renders the new-Zap builder and accepts the default comment once fields load', async () => {
    const fixture = TestBed.createComponent(ZapEditorPage);
    await fixture.whenStable();
    http.expectOne('/api/apps').flush({ apps: [github] });
    http.expectOne('/api/github/repos').flush({ repos: [{ id: 1, fullName: 'octo/demo', private: false }] });
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Trigger');
    expect(el.textContent).toContain('octo/demo');
    expect(el.textContent).not.toContain('Not a field of this trigger');
  });

  it('shows "not found" for a malformed Zap id (server answers 400)', async () => {
    const fixture = TestBed.createComponent(ZapEditorPage);
    fixture.componentRef.setInput('id', 'not-an-id');
    await fixture.whenStable();
    http.expectOne('/api/apps').flush({ apps: [github] });
    http.expectOne('/api/zaps/not-an-id').flush({}, { status: 400, statusText: 'Bad Request' });
    http.expectOne('/api/github/repos').flush({ repos: [] });
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain("This Zap doesn't exist");
  });
});
