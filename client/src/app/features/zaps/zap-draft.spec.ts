import { describe, expect, it } from 'vitest';
import { DRAFT_STATE_KEY, draftFromState } from './zap-draft';

describe('draftFromState', () => {
  const draft = { name: 'Thank authors', body: 'Thanks {{pr.author}}', explanation: 'Thanks authors.', repo: { id: 1, fullName: 'octo/demo' } };

  it('reads a well-formed draft', () => {
    expect(draftFromState({ [DRAFT_STATE_KEY]: draft })).toEqual(draft);
  });

  it('drops a malformed repo but keeps the draft', () => {
    expect(draftFromState({ [DRAFT_STATE_KEY]: { ...draft, repo: { id: '1' } } })?.repo).toBeNull();
  });

  it('ignores missing or foreign state', () => {
    expect(draftFromState(undefined)).toBeNull();
    expect(draftFromState({ navigationId: 3 })).toBeNull();
    expect(draftFromState({ [DRAFT_STATE_KEY]: { name: 1 } })).toBeNull();
  });
});
