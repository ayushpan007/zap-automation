import { describe, expect, it } from 'vitest';
import { extractTokens, findUnknownTokens, renderTemplate } from './template.js';

describe('template', () => {
  it('extracts distinct tokens, tolerating whitespace', () => {
    expect(extractTokens('Hi {{ pr.author }}, {{pr.title}} by {{pr.author}}')).toEqual(['pr.author', 'pr.title']);
  });

  it('renders nested values and blanks out missing ones', () => {
    const out = renderTemplate('Thanks @{{pr.author}} for #{{pr.number}}{{pr.missing}}', { pr: { author: 'octo', number: 42 } });
    expect(out).toBe('Thanks @octo for #42');
  });

  it('leaves text without tokens unchanged', () => {
    expect(renderTemplate('Thanks!', {})).toBe('Thanks!');
  });

  it('reports tokens that are not allowed', () => {
    expect(findUnknownTokens('{{pr.title}} {{secrets.token}}', ['pr.title'])).toEqual(['secrets.token']);
  });
});
