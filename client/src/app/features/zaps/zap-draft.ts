import type { ZapDraft } from '../../core/api.types';

/** Key under which the Copilot passes its draft to the editor in router navigation state. */
export const DRAFT_STATE_KEY = 'copilotDraft';

/**
 * Pure: reads a Copilot draft out of navigation state. History state can hold anything
 * (old entries, other features), so check the shape instead of trusting a cast.
 */
export const draftFromState = (state: unknown): ZapDraft | null => {
  const d = (state as Record<string, unknown> | null | undefined)?.[DRAFT_STATE_KEY] as Partial<ZapDraft> | undefined;
  if (!d || typeof d.name !== 'string' || typeof d.body !== 'string' || typeof d.explanation !== 'string') return null;
  const repo = d.repo && typeof d.repo.id === 'number' && typeof d.repo.fullName === 'string' ? { id: d.repo.id, fullName: d.repo.fullName } : null;
  return { name: d.name, body: d.body, explanation: d.explanation, repo };
};
