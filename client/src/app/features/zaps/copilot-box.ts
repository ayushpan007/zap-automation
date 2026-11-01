import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { apiErrorMessage } from '../../core/api-error';
import { ZapsApi } from '../../core/zaps.api';
import { DRAFT_STATE_KEY } from './zap-draft';

const EXAMPLES = ['When a pull request is opened, comment thanks', 'Ask PR authors to link the issue their change fixes'];

/**
 * Plain English → draft Zap. The server asks Claude for a draft; nothing is saved here. The draft
 * opens in the normal editor (via router state) so the user reviews it, picks a repo, and saves it off.
 */
@Component({
  selector: 'app-copilot-box',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="box" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <label for="copilot-text" class="label">Describe a Zap <span class="tag">Copilot</span></label>
      <div class="row">
        <input
          id="copilot-text"
          class="input"
          formControlName="text"
          [placeholder]="'e.g. ' + examples[0]"
          maxlength="500"
          autocomplete="off"
          [attr.aria-invalid]="!!error()"
          aria-describedby="copilot-help"
        />
        <button type="submit" class="btn btn-primary" [disabled]="busy()">{{ busy() ? 'Drafting…' : 'Draft Zap' }}</button>
      </div>
      @if (error(); as message) {
        <p id="copilot-help" class="error-text" role="alert">{{ message }}</p>
      } @else {
        <p id="copilot-help" class="hint">
          Opens a draft in the builder for you to review. It stays off until you turn it on.
          <button type="button" class="link-btn" (click)="useExample(1)">Try: “{{ examples[1] }}”</button>
        </p>
      }
    </form>
  `,
  styles: `
    .box {
      display: grid; gap: var(--space-2); margin-bottom: var(--space-5);
      padding: var(--space-4); background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
    }
    .label { font-weight: 600; font-size: var(--text-sm); display: inline-flex; align-items: center; gap: var(--space-2); }
    .tag { font-size: var(--text-xs); font-weight: 500; color: var(--accent); background: var(--accent-soft); padding: 1px 6px; border-radius: 4px; }
    .row { display: flex; gap: var(--space-2); }
    .row .input { flex: 1; min-width: 0; }
    .row .btn { white-space: nowrap; }
    .hint, .error-text { margin: 0; }
    .link-btn { border: 0; background: none; padding: 0; font: inherit; color: inherit; text-decoration: underline; cursor: pointer; }
    @media (max-width: 560px) { .row { flex-direction: column; } }
  `,
})
export class CopilotBox {
  private readonly api = inject(ZapsApi);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly examples = EXAMPLES;
  // ngSubmit (and Enter-to-submit) only fires on a <form> with a forms directive, hence the group.
  protected readonly form = new FormGroup({
    text: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
  });
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected useExample(i: number): void {
    this.form.controls.text.setValue(EXAMPLES[i] ?? '');
    this.error.set(null);
  }

  protected submit(): void {
    if (this.busy()) return;
    const text = this.form.controls.text.value.trim();
    if (text.length < 3) {
      this.error.set('Describe the Zap you want, e.g. “' + EXAMPLES[0] + '”.');
      return;
    }
    this.error.set(null);
    this.busy.set(true);
    this.api
      .draft(text)
      .pipe(finalize(() => this.busy.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (draft) => void this.router.navigate(['/zaps/new'], { state: { [DRAFT_STATE_KEY]: draft } }),
        // Keep the text so the user can rephrase; the server's message says what went wrong.
        error: (err: unknown) => this.error.set(apiErrorMessage(err, 'Copilot could not draft a Zap. Try again.')),
      });
  }
}
