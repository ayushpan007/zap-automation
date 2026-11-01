import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Client copy of the server's {{token}} rules, used only for instant feedback and the live preview.
 * The server (lib/template.ts + zap.schema.ts) remains the authority and re-validates on save.
 */
const TOKEN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export const extractTokens = (template: string): string[] => [
  ...new Set([...template.matchAll(TOKEN)].map((m) => m[1] as string)),
];

export const renderPreview = (template: string, examples: Readonly<Record<string, string>>): string =>
  template.replace(TOKEN, (_m, path: string) => examples[path] ?? '');

/** Pure string edit: insert text at a caret position, returning the new value and caret. */
export const insertAt = (value: string, start: number, end: number, text: string) => ({
  value: value.slice(0, start) + text + value.slice(end),
  caret: start + text.length,
});

/** Reactive Forms validator: flags {{tokens}} the selected trigger doesn't provide. */
export const knownTokensValidator =
  (allowed: () => readonly string[]): ValidatorFn =>
  (control: AbstractControl<string>): ValidationErrors | null => {
    const unknown = extractTokens(control.value ?? '').filter((t) => !allowed().includes(t));
    return unknown.length ? { unknownTokens: unknown } : null;
  };
