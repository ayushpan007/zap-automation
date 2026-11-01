import { ChangeDetectionStrategy, Component, type ElementRef, computed, input, viewChild } from '@angular/core';
import { type FormControl, ReactiveFormsModule } from '@angular/forms';
import type { TriggerField } from '../../core/api.types';
import { insertAt, renderPreview } from '../../shared/template';

/**
 * Field mapping UI: a template textarea, clickable trigger fields that insert {{tokens}} at the
 * caret, and a live preview filled with example values.
 */
@Component({
  selector: 'app-comment-editor',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field">
      <label for="comment-body">Comment</label>
      <textarea
        #area
        id="comment-body"
        class="textarea"
        [formControl]="control()"
        [attr.aria-invalid]="!!errorText()"
        aria-describedby="comment-help comment-error"
      ></textarea>
      <p id="comment-error" class="error-text" aria-live="polite">{{ errorText() }}</p>
    </div>

    <div class="fields">
      <p id="comment-help" class="hint">Insert data from the pull request:</p>
      <ul>
        @for (f of fields(); track f.path) {
          <li>
            <button type="button" class="chip" (click)="insert(f.path)" [title]="'Example: ' + f.example">
              {{ f.label }} <code>{{ '{{' }}{{ f.path }}{{ '}}' }}</code>
            </button>
          </li>
        }
      </ul>
    </div>

    <figure class="preview">
      <figcaption>Preview with example data</figcaption>
      <p>{{ preview() || 'Your comment will appear here.' }}</p>
    </figure>
  `,
  styles: `
    :host { display: grid; gap: var(--space-3); }
    .error-text { min-height: 1em; margin: 0; }
    .fields ul { list-style: none; margin: var(--space-1) 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--space-1); }
    .fields .hint { margin: 0; }
    .chip {
      border: 1px solid var(--line); background: var(--surface-sunken); border-radius: 4px;
      padding: 2px 8px; font: inherit; font-size: var(--text-xs); color: var(--ink-2); cursor: pointer;
    }
    .chip:hover { border-color: var(--line-strong); color: var(--ink); }
    .chip code { color: var(--accent); }
    .preview { margin: 0; border-left: 2px solid var(--line-strong); padding: var(--space-1) 0 var(--space-1) var(--space-3); }
    figcaption { font-size: var(--text-xs); color: var(--muted); }
    .preview p { margin: var(--space-1) 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  `,
})
export class CommentEditor {
  readonly control = input.required<FormControl<string>>();
  /** The control's current value as a signal, supplied by the page that owns the form. */
  readonly value = input.required<string>();
  readonly fields = input.required<TriggerField[]>();
  /** Show "required" errors only after the user tried to save. */
  readonly submitted = input(false);
  /** Error from the server for this field, shown when the client check passed but the server disagreed. */
  readonly serverError = input<string | null>(null);

  private readonly area = viewChild.required<ElementRef<HTMLTextAreaElement>>('area');

  protected readonly preview = computed(() =>
    renderPreview(this.value(), Object.fromEntries(this.fields().map((f) => [f.path, f.example]))),
  );

  // control().errors is not a signal, so this reads value() and fields() to recompute whenever the
  // errors can change: on every edit, and when the field list arrives and the page re-validates.
  protected readonly errorText = computed(() => {
    const value = this.value();
    const fieldsLoaded = this.fields().length > 0;
    const errors = this.control().errors;
    const unknown = errors?.['unknownTokens'] as string[] | undefined;
    if (unknown && fieldsLoaded) return `Not a field of this trigger: ${unknown.map((u) => `{{${u}}}`).join(', ')}`;
    if (errors?.['maxlength']) return 'Comments are limited to 5,000 characters.';
    if (!value.trim() && this.submitted()) return 'Write the comment to post.';
    return this.serverError() ?? '';
  });

  protected insert(path: string): void {
    const el = this.area().nativeElement;
    const next = insertAt(el.value, el.selectionStart, el.selectionEnd, `{{${path}}}`);
    this.control().setValue(next.value);
    this.control().markAsDirty();
    el.focus();
    el.setSelectionRange(next.caret, next.caret);
  }
}
