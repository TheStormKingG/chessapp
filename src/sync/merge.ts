import type { LearnerEvent } from '@/data';

/**
 * F-AC-2: combine two event logs by their identifiers. The local copy of a
 * shared id wins (it already carries this device's payload) and the result is
 * ordered by creation time so a rebuild replays it in order.
 */
export function mergeEvents(local: LearnerEvent[], remote: LearnerEvent[]): LearnerEvent[] {
  const m = new Map<string, LearnerEvent>();
  for (const e of [...local, ...remote]) if (!m.has(e.id)) m.set(e.id, e);
  return [...m.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
