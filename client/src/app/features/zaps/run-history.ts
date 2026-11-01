import { ChangeDetectionStrategy, Component, inject, input, signal, type OnInit } from '@angular/core';
import type { Run } from '../../core/api.types';
import { ZapsApi } from '../../core/zaps.api';
import { relativeTime } from '../../shared/format';

/** Last 20 runs of a Zap: the answer to "did it fire, and did the comment post?" */
@Component({
  selector: 'app-run-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <h2>Recent runs</h2>
      <button type="button" class="btn btn-quiet" (click)="load()" [disabled]="state() === 'loading'">Refresh</button>
    </div>
    @switch (state()) {
      @case ('loading') { <p class="hint" aria-live="polite">Loading runs…</p> }
      @case ('error') { <p class="error-text" role="alert">Runs couldn't be loaded.</p> }
      @default {
        @if (runs().length === 0) {
          <p class="hint">No runs yet. Turn the Zap on, then open a pull request in the repository.</p>
        } @else {
          <ol>
            @for (run of runs(); track run.id) {
              <li>
                <span class="status" [class.status-on]="run.status === 'succeeded'" [class.status-failed]="run.status === 'failed'">
                  {{ run.status === 'succeeded' ? 'Commented' : run.status === 'failed' ? 'Failed' : 'Running' }}
                </span>
                <a [href]="run.pullRequest.url" target="_blank" rel="noopener" class="pr">#{{ run.pullRequest.number }} {{ run.pullRequest.title }}</a>
                <span class="when">{{ relativeTime(run.createdAt, now()) }}</span>
                @if (run.commentUrl) {
                  <a [href]="run.commentUrl" target="_blank" rel="noopener" class="link">View comment</a>
                }
                @if (run.error) {
                  <p class="error-text err">{{ run.error }}</p>
                }
              </li>
            }
          </ol>
        }
      }
    }
  `,
  styles: `
    :host { display: block; }
    .head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2); }
    h2 { font-size: var(--text-md); }
    ol { list-style: none; margin: 0; padding: 0; }
    li {
      display: grid; grid-template-columns: 96px 1fr auto; gap: 2px var(--space-3); align-items: baseline;
      padding: var(--space-2) 0; border-top: 1px solid var(--line); font-size: var(--text-sm);
    }
    .pr { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-decoration: none; }
    .pr:hover { text-decoration: underline; }
    .when { color: var(--muted); font-size: var(--text-xs); white-space: nowrap; }
    .link { grid-column: 2; font-size: var(--text-xs); color: var(--ink-2); }
    .err { grid-column: 2 / -1; margin: 0; overflow-wrap: anywhere; }
    .hint { margin: 0; }
  `,
})
export class RunHistory implements OnInit {
  private readonly api = inject(ZapsApi);
  readonly zapId = input.required<string>();

  protected readonly runs = signal<Run[]>([]);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly now = signal(Date.now());
  protected readonly relativeTime = relativeTime;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.api.runs(this.zapId()).subscribe({
      next: (runs) => {
        this.runs.set(runs);
        this.now.set(Date.now());
        this.state.set('ready');
      },
      error: () => this.state.set('error'),
    });
  }
}
