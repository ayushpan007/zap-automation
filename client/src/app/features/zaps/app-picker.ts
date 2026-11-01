import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { AppDef } from '../../core/api.types';

/**
 * Grid of developer tools for one step. Apps that can't run yet are visible but disabled and labelled,
 * so the picker shows where the product is going without any button pretending to work.
 */
@Component({
  selector: 'app-app-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid" role="radiogroup" [attr.aria-label]="label()">
      @for (app of options(); track app.key) {
        <button
          type="button"
          role="radio"
          class="app"
          [class.selected]="app.key === selected()"
          [attr.aria-checked]="app.key === selected()"
          [disabled]="!app.available"
          (click)="selectedChange.emit(app.key)"
        >
          <span class="mark" aria-hidden="true">{{ app.name.charAt(0) }}</span>
          <span class="name">{{ app.name }}</span>
          <span class="meta">{{ app.available ? app.category : 'Coming soon' }}</span>
        </button>
      }
    </div>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: var(--space-2); }
    .app {
      display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; column-gap: var(--space-2);
      align-items: center; text-align: left; padding: var(--space-2) var(--space-3);
      border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface);
      font: inherit; color: inherit; cursor: pointer;
    }
    .app:hover:not(:disabled) { border-color: var(--line-strong); }
    .app.selected { border-color: var(--ink); box-shadow: inset 0 0 0 1px var(--ink); }
    .app:disabled { cursor: not-allowed; background: transparent; }
    .app:disabled .name, .app:disabled .mark { opacity: 0.5; }
    .mark {
      grid-row: span 2; width: 28px; height: 28px; border-radius: 6px; display: grid; place-items: center;
      background: var(--surface-sunken); font-weight: 600; font-size: var(--text-sm);
    }
    .selected .mark { background: var(--ink); color: #fff; }
    .name { font-size: var(--text-sm); font-weight: 600; }
    .meta { font-size: var(--text-xs); color: var(--muted); }
  `,
})
export class AppPicker {
  readonly apps = input.required<AppDef[]>();
  // Named `step`, not `role`: a static `role="..."` attribute would also land on the host as an invalid ARIA role.
  readonly step = input.required<'trigger' | 'action'>();
  readonly selected = input.required<string>();
  readonly label = input.required<string>();
  readonly selectedChange = output<string>();

  /** Only apps that offer something for this step (e.g. Slack has actions but no triggers). */
  protected readonly options = computed(() =>
    this.apps().filter((a) => (this.step() === 'trigger' ? a.triggers.length : a.actions.length) > 0),
  );
}
