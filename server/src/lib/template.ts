/**
 * Field mapping: comment templates reference trigger data with {{path.to.field}} tokens.
 * Everything here is pure so it can be unit-tested and reused by validation and execution.
 */
const TOKEN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export type TemplateContext = Readonly<Record<string, unknown>>;

/** Distinct token paths used in a template, in order of first appearance. */
export const extractTokens = (template: string): readonly string[] => [
  ...new Set([...template.matchAll(TOKEN)].map((m) => m[1] as string)),
];

/** Tokens in the template that are not in the allowed list. */
export const findUnknownTokens = (template: string, allowed: readonly string[]): readonly string[] =>
  extractTokens(template).filter((t) => !allowed.includes(t));

const lookup = (context: TemplateContext, path: string): unknown =>
  path.split('.').reduce<unknown>(
    (value, key) => (value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined),
    context,
  );

/** Replace every token with its value from context. Missing values render as an empty string. */
export const renderTemplate = (template: string, context: TemplateContext): string =>
  template.replace(TOKEN, (_match, path: string) => {
    const value = lookup(context, path);
    return value === undefined || value === null ? '' : String(value);
  });
