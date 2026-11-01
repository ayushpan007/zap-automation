import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal, type OnInit } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { apiErrorMessage, apiFieldErrors } from '../../core/api-error';
import type { AppDef, Repo, Zap, ZapInput } from '../../core/api.types';
import { ZapsApi } from '../../core/zaps.api';
import { knownTokensValidator } from '../../shared/template';
import { Toggle } from '../../shared/toggle';
import { AppPicker } from './app-picker';
import { CommentEditor } from './comment-editor';
import { RunHistory } from './run-history';

const DEFAULT_COMMENT = 'Thanks @{{pr.author}} for opening "{{pr.title}}"! A maintainer will review it soon.';

/**
 * Builder for one Zap: step 1 trigger, step 2 action, plus name/status. Serves both
 * /zaps/new (no id) and /zaps/:id (id bound from the route via withComponentInputBinding).
 */
@Component({
  selector: 'app-zap-editor-page',
  imports: [ReactiveFormsModule, RouterLink, AppPicker, CommentEditor, RunHistory, Toggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './zap-editor.page.html',
  styleUrl: './zap-editor.page.css',
})
export class ZapEditorPage implements OnInit {
  private readonly api = inject(ZapsApi);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Route param :id. Undefined on /zaps/new. */
  readonly id = input<string>();
  protected readonly isNew = computed(() => !this.id());

  protected readonly apps = signal<AppDef[]>([]);
  protected readonly repos = signal<Repo[]>([]);
  protected readonly reposError = signal<string | null>(null);
  protected readonly loadState = signal<'loading' | 'ready' | 'error' | 'not-found'>('loading');
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly fieldErrors = signal<Record<string, string>>({});
  protected readonly savedNotice = signal<string | null>(null);
  protected readonly confirmingDelete = signal(false);
  /** The Zap's saved repo; plain field because only withCurrentRepo reads it. */
  private currentRepo: Repo | null = null;

  // Only GitHub can be selected today; these are signals so the pickers and selects stay reactive.
  protected readonly triggerApp = signal('github');
  protected readonly actionApp = signal('github');

  // Declared before `form`: Angular runs the body validator while building the form, and the
  // validator reads fieldPaths(). Class fields initialise top to bottom, so order matters here.
  protected readonly trigger = computed(() => this.apps().find((a) => a.key === this.triggerApp())?.triggers[0]);
  protected readonly action = computed(() => this.apps().find((a) => a.key === this.actionApp())?.actions[0]);
  protected readonly fields = computed(() => this.trigger()?.fields ?? []);
  private readonly fieldPaths = computed(() => this.fields().map((f) => f.path));

  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    enabled: [false],
    repoId: this.fb.control<number | null>(null, Validators.required),
    body: [DEFAULT_COMMENT, [Validators.required, Validators.maxLength(5000), knownTokensValidator(() => this.fieldPaths())]],
  });

  /** valueChanges (an Observable) as a signal, so computed() and child inputs can react to typing. */
  protected readonly bodyValue = toSignal(this.form.controls.body.valueChanges, { initialValue: DEFAULT_COMMENT });

  ngOnInit(): void {
    // The form is only usable once the field list (from apps) and, when editing, the Zap are both
    // here; forkJoin waits for both, so one request's success can't hide the other's failure.
    const id = this.id();
    forkJoin({ apps: this.api.apps(), zap: id ? this.api.get(id) : of(null) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ apps, zap }) => {
          this.apps.set(apps);
          if (zap) this.fillForm(zap);
          // Field list just arrived; re-run the token validator against it.
          this.form.controls.body.updateValueAndValidity();
          this.loadState.set('ready');
        },
        // 400 = malformed id in the URL, 404 = no such Zap (or not yours): both are "not found" to the user.
        error: (err: unknown) => {
          const status = (err as { status?: number }).status;
          this.loadState.set(status === 404 || status === 400 ? 'not-found' : 'error');
        },
      });
    this.loadRepos();
  }

  protected loadRepos(): void {
    this.reposError.set(null);
    this.api
      .repos()
      .pipe(
        catchError((err: unknown) => {
          this.reposError.set(apiErrorMessage(err, 'Your repositories could not be loaded from GitHub.'));
          return of([] as Repo[]);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((repos) => this.repos.set(this.withCurrentRepo(repos)));
  }

  protected save(): void {
    // Checked first so pressing Enter mid-save doesn't wipe the messages on screen.
    if (this.saving()) return;
    this.submitted.set(true);
    this.saveError.set(null);
    this.fieldErrors.set({});
    this.savedNotice.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const input = this.toInput();
    if (!input) {
      this.saveError.set('Pick a repository for the trigger.');
      return;
    }
    const id = this.id();
    const request = id ? this.api.update(id, input) : this.api.create(input);

    // The `saving` flag plus the disabled button stops double submits while a request is in flight.
    // takeUntilDestroyed: if the user leaves mid-save, a late response must not navigate them back here.
    this.saving.set(true);
    request.pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (zap) => {
        this.form.markAsPristine();
        if (!id) {
          void this.router.navigate(['/zaps', zap.id], { replaceUrl: true });
          return;
        }
        this.fillForm(zap);
        this.savedNotice.set(zap.enabled ? 'Saved. The Zap is on and listening for new pull requests.' : 'Saved. The Zap is off.');
      },
      error: (err: unknown) => {
        // Keep everything the user typed; show the reason next to the field when the server says which one.
        this.fieldErrors.set(apiFieldErrors(err));
        this.saveError.set(apiErrorMessage(err));
      },
    });
  }

  protected askDelete(): void {
    this.confirmingDelete.set(true);
  }

  protected delete(): void {
    const id = this.id();
    if (!id) return;
    this.saving.set(true);
    this.api
      .remove(id)
      .pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => void this.router.navigate(['/zaps']),
        error: (err: unknown) => {
          this.confirmingDelete.set(false);
          this.saveError.set(apiErrorMessage(err));
        },
      });
  }

  protected repoLabel(repo: Repo): string {
    return repo.private ? `${repo.fullName} (private)` : repo.fullName;
  }

  /** Pure mapping from form state to the API contract. Null when no repo is chosen. */
  private toInput(): ZapInput | null {
    const v = this.form.getRawValue();
    const repo = this.repos().find((r) => r.id === v.repoId);
    if (!repo) return null;
    return {
      name: v.name.trim(),
      enabled: v.enabled,
      trigger: { app: 'github', event: 'pull_request.opened', repo: { id: repo.id, fullName: repo.fullName } },
      action: { app: 'github', type: 'pull_request.comment', body: v.body },
    };
  }

  private fillForm(zap: Zap): void {
    this.form.reset({ name: zap.name, enabled: zap.enabled, repoId: zap.trigger.repo.id, body: zap.action.body });
    this.currentRepo = { ...zap.trigger.repo, private: false };
    this.repos.update((repos) => this.withCurrentRepo(repos));
  }

  // Keeps the saved repo selectable even if GitHub no longer lists it (e.g. admin rights were removed).
  private withCurrentRepo(repos: Repo[]): Repo[] {
    const current = this.currentRepo;
    return current && !repos.some((r) => r.id === current.id) ? [current, ...repos] : repos;
  }
}
