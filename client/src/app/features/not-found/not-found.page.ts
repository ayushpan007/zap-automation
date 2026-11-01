import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main>
      <p class="code mono">404</p>
      <h1>This page doesn't exist</h1>
      <p>The link may be wrong, or the Zap was deleted.</p>
      <a routerLink="/zaps" class="btn">Back to your Zaps</a>
    </main>
  `,
  styles: `
    main { max-width: 480px; margin: 15vh auto; padding: 0 var(--space-4); display: grid; gap: var(--space-3); justify-items: start; }
    .code { color: var(--accent); margin: 0; }
    p { margin: 0; color: var(--ink-2); }
  `,
})
export class NotFoundPage {}
