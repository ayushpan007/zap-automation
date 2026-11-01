import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * On/off switch built on a native checkbox, so keyboard and screen readers work for free.
 * Controlled: it always shows `checked` from the parent and only *requests* a change. The parent
 * flips `checked` once the server agrees, so a failed request can never leave the switch lying.
 */
@Component({
  selector: 'app-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="switch" [class.busy]="busy()">
      <input
        type="checkbox"
        role="switch"
        [checked]="checked()"
        [disabled]="disabled() || busy()"
        [attr.aria-label]="label()"
        (change)="onChange($event)"
      />
      <span class="track" aria-hidden="true"><span class="thumb"></span></span>
    </label>
  `,
  styles: `
    .switch { position: relative; display: inline-flex; cursor: pointer; }
    input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: inherit; }
    .track {
      width: 34px; height: 20px; border-radius: 10px; background: var(--line-strong);
      display: inline-flex; align-items: center; padding: 2px; transition: background-color 150ms ease;
    }
    .thumb { width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / 0.2); transition: transform 150ms ease; }
    input:checked + .track { background: var(--ok); }
    input:checked + .track .thumb { transform: translateX(14px); }
    input:focus-visible + .track { outline: 2px solid var(--accent); outline-offset: 2px; }
    input:disabled { cursor: not-allowed; }
    .busy .track { opacity: 0.6; }
  `,
})
export class Toggle {
  readonly checked = input.required<boolean>();
  readonly label = input.required<string>();
  readonly disabled = input(false);
  readonly busy = input(false);
  readonly toggled = output<boolean>();

  protected onChange(event: Event): void {
    const box = event.target as HTMLInputElement;
    const requested = box.checked;
    box.checked = this.checked();
    this.toggled.emit(requested);
  }
}
