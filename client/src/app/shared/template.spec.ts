import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { extractTokens, insertAt, knownTokensValidator, renderPreview } from './template';

describe('template helpers', () => {
  it('extracts unique tokens', () => {
    expect(extractTokens('{{pr.title}} {{ pr.title }} {{pr.author}}')).toEqual(['pr.title', 'pr.author']);
  });

  it('renders a preview with example values', () => {
    expect(renderPreview('Hi @{{pr.author}}{{x}}', { 'pr.author': 'octocat' })).toBe('Hi @octocat');
  });

  it('inserts at the caret', () => {
    expect(insertAt('Hello !', 6, 6, '{{pr.author}}')).toEqual({ value: 'Hello {{pr.author}}!', caret: 19 });
  });

  it('validates tokens against the allowed list', () => {
    const control = new FormControl('{{pr.title}} {{nope}}', { nonNullable: true, validators: knownTokensValidator(() => ['pr.title']) });
    expect(control.errors).toEqual({ unknownTokens: ['nope'] });
    control.setValue('{{pr.title}}');
    expect(control.valid).toBe(true);
  });
});
