import { describe, expect, it } from 'vitest';
import { relativeTime, replaceById } from './format';

describe('format', () => {
  const now = Date.parse('2026-10-28T12:00:00Z');

  it('formats relative times', () => {
    expect(relativeTime('2026-10-28T11:59:50Z', now)).toBe('just now');
    expect(relativeTime('2026-10-28T11:30:00Z', now)).toBe('30m ago');
    expect(relativeTime('2026-10-28T07:00:00Z', now)).toBe('5h ago');
    expect(relativeTime('2026-10-25T12:00:00Z', now)).toBe('3d ago');
  });

  it('replaces by id without mutating the input', () => {
    const list = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }];
    const next = replaceById(list, { id: 'b', v: 3 });
    expect(next).toEqual([{ id: 'a', v: 1 }, { id: 'b', v: 3 }]);
    expect(list[1]).toEqual({ id: 'b', v: 2 });
  });
});
