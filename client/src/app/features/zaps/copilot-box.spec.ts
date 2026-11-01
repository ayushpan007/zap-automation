import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CopilotBox } from './copilot-box';
import { DRAFT_STATE_KEY } from './zap-draft';

describe('CopilotBox', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  const render = async () => {
    const fixture = TestBed.createComponent(CopilotBox);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const type = async (text: string) => {
      const input = el.querySelector('input') as HTMLInputElement;
      input.value = text;
      input.dispatchEvent(new Event('input'));
      (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
      await fixture.whenStable();
    };
    return { fixture, el, type };
  };

  it('sends the text and opens the draft in the editor', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { type } = await render();
    await type('  When a PR is opened, comment thanks ');

    const req = http.expectOne('/api/copilot/draft');
    expect(req.request.body).toEqual({ text: 'When a PR is opened, comment thanks' });
    const draft = { name: 'Thanks', body: 'Thanks!', repo: null, explanation: 'Thanks authors.' };
    req.flush(draft);

    expect(navigate).toHaveBeenCalledWith(['/zaps/new'], { state: { [DRAFT_STATE_KEY]: draft } });
  });

  it('does not call the server for an empty description', async () => {
    const { el, type } = await render();
    await type(' ');
    http.expectNone('/api/copilot/draft');
    expect(el.textContent).toContain('Describe the Zap you want');
  });

  it("shows the server's reason and keeps the text when drafting fails", async () => {
    const { fixture, el, type } = await render();
    await type('post to slack');
    http
      .expectOne('/api/copilot/draft')
      .flush({ error: { code: 'BAD_REQUEST', message: 'Posting to Slack is not available yet.' } }, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Posting to Slack is not available yet.');
    expect((el.querySelector('input') as HTMLInputElement).value).toBe('post to slack');
  });
});
