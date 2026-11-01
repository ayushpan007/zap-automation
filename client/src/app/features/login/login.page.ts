import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { BrandMark } from '../../shared/brand-mark';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: 'The sign-in link expired or was opened in a different browser. Please try again.',
  github_failed: 'GitHub sign-in did not complete. Please try again.',
  server: "Can't reach the Zaps server. Check that it's running, then reload the page.",
};

@Component({
  selector: 'app-login-page',
  imports: [BrandMark],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="wrap">
      <section class="intro">
        <p class="brand"><app-brand-mark /> Zaps</p>
        <h1>Automate the busywork around pull requests.</h1>
        <p class="lede">
          Connect a repository, pick a trigger, and Zaps reacts to new pull requests for you —
          starting with a comment on every PR that opens.
        </p>
        @if (errorMessage(); as message) {
          <p class="banner banner-error" role="alert">{{ message }}</p>
        }
        <button type="button" class="btn btn-primary signin" (click)="auth.signIn()">
          <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          Continue with GitHub
        </button>
        <p class="hint">
          We ask for the <code>repo</code> scope so Zaps can add a webhook to repositories you choose and comment as you.
        </p>
      </section>

      <section class="example" aria-label="Example Zap">
        <p class="eyebrow">Example</p>
        <ol class="flow">
          <li>
            <span class="step-label">When</span>
            <span class="step-title">Pull request opened</span>
            <span class="step-meta mono">acme/web</span>
          </li>
          <li>
            <span class="step-label">Then</span>
            <span class="step-title">Comment on the pull request</span>
            <span class="step-meta mono">Thanks &#64;{{ '{{' }}pr.author{{ '}}' }} — a reviewer will be with you shortly.</span>
          </li>
        </ol>
      </section>
    </main>
  `,
  styles: `
    .wrap {
      min-height: 100vh; max-width: var(--page-width); margin: 0 auto; padding: var(--space-7) var(--space-4);
      display: grid; grid-template-columns: 1.1fr 1fr; gap: var(--space-7); align-items: center;
    }
    .intro { display: grid; gap: var(--space-4); justify-items: start; max-width: 460px; }
    .brand { display: inline-flex; align-items: center; gap: var(--space-2); font-weight: 600; margin: 0; }
    h1 { font-size: 2rem; letter-spacing: -0.01em; }
    .lede { margin: 0; color: var(--ink-2); font-size: var(--text-lg); }
    .signin { min-height: 44px; padding: 0 var(--space-5); font-size: var(--text-md); }
    .hint { margin: 0; max-width: 380px; }
    .example { border-left: 1px solid var(--line); padding-left: var(--space-6); }
    .eyebrow { margin: 0 0 var(--space-3); font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
    .flow { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-5); position: relative; }
    .flow::before { content: ''; position: absolute; left: 5px; top: 10px; bottom: 10px; width: 1px; background: var(--line-strong); }
    .flow li { display: grid; gap: 2px; padding-left: var(--space-5); position: relative; }
    .flow li::before {
      content: ''; position: absolute; left: 0; top: 6px; width: 11px; height: 11px; border-radius: 50%;
      background: var(--bg); border: 2px solid var(--ink);
    }
    .flow li:last-child::before { border-color: var(--accent); }
    .step-label { font-size: var(--text-xs); color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
    .step-title { font-weight: 600; }
    .step-meta { color: var(--ink-2); font-size: var(--text-sm); }
    @media (max-width: 760px) {
      .wrap { grid-template-columns: 1fr; gap: var(--space-6); padding-top: var(--space-6); align-content: start; }
      h1 { font-size: 1.6rem; }
      .example { border-left: 0; padding-left: 0; border-top: 1px solid var(--line); padding-top: var(--space-5); }
    }
  `,
})
export class LoginPage {
  protected readonly auth = inject(AuthService);

  /** Bound from the ?error= query param (withComponentInputBinding). */
  readonly error = input<string>();
  protected readonly errorMessage = computed(() => {
    const code = this.error();
    return code ? (ERROR_MESSAGES[code] ?? 'Sign-in failed. Please try again.') : null;
  });
}
