/** Pure display helpers. `now` is a parameter, not Date.now(), so output is deterministic in tests. */
export const relativeTime = (iso: string, now: number): string => {
  const seconds = Math.round((now - new Date(iso).getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

/** Immutable list update: replaces the item with the same id, keeping order. */
export const replaceById = <T extends { id: string }>(items: readonly T[], next: T): T[] =>
  items.map((item) => (item.id === next.id ? next : item));
