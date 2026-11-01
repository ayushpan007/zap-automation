import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api-error';
import type { Zap } from '../../core/api.types';
import { ZapsApi } from '../../core/zaps.api';
import { relativeTime, replaceById } from '../../shared/format';
import { Toggle } from '../../shared/toggle';
import { CopilotBox } from './copilot-box';

type LoadState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-zap-list-page',
  imports: [RouterLink, Toggle, CopilotBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './zap-list.page.html',
  styleUrl: './zap-list.page.css',
})
export class ZapListPage {
  private readonly api = inject(ZapsApi);

  protected readonly state = signal<LoadState>('loading');
  protected readonly zaps = signal<Zap[]>([]);
  protected readonly pendingIds = signal<ReadonlySet<string>>(new Set());
  protected readonly actionError = signal<string | null>(null);
  protected readonly now = Date.now();
  protected readonly relativeTime = relativeTime;

  constructor() {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.api.list().subscribe({
      next: (zaps) => {
        this.zaps.set(zaps);
        this.state.set('ready');
      },
      error: () => this.state.set('error'),
    });
  }

  /** Waits for the server instead of flipping optimistically: turning on can fail (no admin rights, webhook error). */
  protected setEnabled(zap: Zap, enabled: boolean): void {
    this.actionError.set(null);
    this.setPending(zap.id, true);
    this.api.update(zap.id, { enabled }).subscribe({
      next: (updated) => {
        this.zaps.update((list) => replaceById(list, updated));
        this.setPending(zap.id, false);
      },
      error: (err: unknown) => {
        this.setPending(zap.id, false);
        this.actionError.set(`Couldn't turn ${enabled ? 'on' : 'off'} “${zap.name}”: ${apiErrorMessage(err)}`);
      },
    });
  }

  private setPending(id: string, pending: boolean): void {
    this.pendingIds.update((ids) => {
      const next = new Set(ids);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}
