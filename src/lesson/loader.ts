import type { CheckpointBank, Lesson } from './types';

type Loader<T> = () => Promise<{ default: T }>;

const lessonModules = import.meta.glob<{ default: Lesson }>('/content/section-*/unit-*/lesson-*.json');
const checkpointModules = import.meta.glob<{ default: CheckpointBank }>('/content/section-*/unit-*/checkpoint.json');

function idFromPath(p: string): string {
  return p.match(/lesson-([\d.]+)\.json$/)![1]!;
}
function unitFromPath(p: string): string {
  return p.match(/unit-([\d.]+)\/checkpoint\.json$/)![1]!;
}

const byId = new Map<string, Loader<Lesson>>(
  Object.entries(lessonModules).map(([p, m]) => [idFromPath(p), m]),
);
const cpByUnit = new Map<string, Loader<CheckpointBank>>(
  Object.entries(checkpointModules).map(([p, m]) => [unitFromPath(p), m]),
);

function numeric(id: string): number[] {
  return id.split('.').map(Number);
}
function cmp(a: string, b: string): number {
  const x = numeric(a);
  const y = numeric(b);
  for (let i = 0; i < 3; i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

export function listLessons(unit: string): string[] {
  return [...byId.keys()].filter((id) => id.startsWith(`${unit}.`)).sort(cmp);
}

export function hasCheckpoint(unit: string): boolean {
  return cpByUnit.has(unit);
}

export async function loadLesson(id: string): Promise<Lesson> {
  const m = byId.get(id);
  if (!m) throw new Error(`Unknown lesson ${id}`);
  return (await m()).default;
}

export async function loadCheckpoint(unit: string): Promise<CheckpointBank> {
  const m = cpByUnit.get(unit);
  if (!m) throw new Error(`Unknown checkpoint ${unit}`);
  return (await m()).default;
}
