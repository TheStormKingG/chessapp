import { create } from 'zustand';
import { db } from './db';
import { newEvent, type EventPayload, type LearnerEvent } from './events';
import { emptyProgress, reduceProgress, type Progress } from './reduce';

interface State {
  progress: Progress;
  loaded: boolean;
  load: () => Promise<void>;
  append: (p: EventPayload) => Promise<LearnerEvent>;
  rebuild: () => Promise<void>;
}

const listeners = new Set<(e: LearnerEvent) => void>();

/** Sync (Task 16) subscribes here to flush after each write. */
export function onEventAppended(fn: (e: LearnerEvent) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const useProgress = create<State>((set, get) => ({
  progress: emptyProgress(),
  loaded: false,
  load: async () => {
    const all = await db.events.toArray();
    set({ progress: reduceProgress(emptyProgress(), all), loaded: true });
  },
  append: async (payload) => {
    const e = newEvent(payload);
    await db.events.add(e);
    set({ progress: reduceProgress(get().progress, [e]) });
    listeners.forEach((l) => {
      l(e);
    });
    return e;
  },
  rebuild: async () => {
    await get().load();
  },
}));
