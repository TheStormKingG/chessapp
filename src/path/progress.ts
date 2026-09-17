import type { Progress } from '@/data';
import { SECTION_1 } from './curriculum';

export type LessonNodeState = 'done' | 'active' | 'locked' | 'coming' | 'testedOut';

export type Node =
  | { kind: 'lesson'; id: string; unit: string; title: string; state: LessonNodeState }
  | { kind: 'checkpoint'; unit: string; title: string; state: 'available' | 'passed' | 'coming' };

/**
 * One vertical list, exactly one active node (F-PA-1). A checkpoint of a built
 * unit is always attemptable so a learner can test out early (F-PA-2); passing
 * it marks the unit complete and unlocks the next one, and the lessons it
 * skipped past read as tested out rather than blocking the active node.
 */
export function pathNodes(p: Progress): Node[] {
  const out: Node[] = [];
  let activeAssigned = false;
  let previousUnitPassed = true;
  for (const u of SECTION_1.units) {
    const passed = p.units[u.id]?.passed ?? false;
    for (const l of u.lessons) {
      if (!u.built) {
        out.push({ kind: 'lesson', id: l.id, unit: u.id, title: l.title, state: 'coming' });
        continue;
      }
      const done = p.lessons[l.id]?.completed ?? false;
      let state: LessonNodeState;
      if (done) state = 'done';
      else if (passed) state = 'testedOut';
      else if (!activeAssigned && previousUnitPassed) {
        state = 'active';
        activeAssigned = true;
      } else state = 'locked';
      out.push({ kind: 'lesson', id: l.id, unit: u.id, title: l.title, state });
    }
    out.push({
      kind: 'checkpoint',
      unit: u.id,
      title: `${u.title} checkpoint`,
      state: !u.built ? 'coming' : passed ? 'passed' : 'available',
    });
    previousUnitPassed = passed;
  }
  return out;
}

export function activeLesson(p: Progress): Extract<Node, { kind: 'lesson' }> | null {
  for (const n of pathNodes(p)) {
    if (n.kind === 'lesson' && n.state === 'active') return n;
  }
  return null;
}
