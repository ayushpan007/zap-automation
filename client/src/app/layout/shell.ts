import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { BrandMark } from '../shared/brand-mark';

/** Frame for signed-in pages: top bar + the active child route. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BrandMark],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="bar">
      <div class="bar-inner">
        <a routerLink="/zaps" class="brand" aria-label="Zaps home"><app-brand-mark /> Zaps</a>
        <nav aria-label="Main">
          <a routerLink="/zaps" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">All Zaps</a>
        </nav>
        @if (auth.user(); as user) {
          <div class="me">
            <img [src]="user.avatarUrl" alt="" width="24" height="24" />
            <span class="login mono">{{ user.login }}</span>
            @if (signOutFailed()) {
              <span class="error-text" role="alert">Sign-out failed. Try again.</span>
            }
            <button type="button" class="btn btn-quiet" (click)="signOut()">Sign out</button>
          </div>
        }
      </div>
    </header>
    <main class="page">
      <router-outlet />
    </main>
  `,
  styles: `
    .bar { background: var(--surface); border-bottom: 1px solid var(--line); }
    .bar-inner {
      max-width: var(--page-width); margin: 0 auto; padding: 0 var(--space-4);
      height: 52px; display: flex; align-items: center; gap: var(--space-5);
    }
    .brand { display: inline-flex; align-items: center; gap: var(--space-2); font-weight: 600; text-decoration: none; }
    nav { display: flex; gap: var(--space-4); font-size: var(--text-sm); }
    nav a { text-decoration: none; color: var(--muted); padding: 14px 0; border-bottom: 2px solid transparent; }
    nav a.active { color: var(--ink); border-bottom-color: var(--accent); }
    .me { margin-left: auto; display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); }
    .me img { border-radius: 50%; }
    .page { max-width: var(--page-width); margin: 0 auto; padding: var(--space-6) var(--space-4) var(--space-7); }
    @media (max-width: 560px) { .login { display: none; } .bar-inner { gap: var(--space-3); } }
  `,
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly signOutFailed = signal(false);

  // One-shot HTTP Observable: it completes after the response, so this subscription cannot leak.
  signOut(): void {
    this.signOutFailed.set(false);
    this.auth.signOut().subscribe({ error: () => this.signOutFailed.set(true) });
  }
}
