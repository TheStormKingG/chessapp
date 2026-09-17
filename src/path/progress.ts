import type { Progress } from '@/data';
import { SECTION_1 } from './curriculum';

export type LessonNodeState = 'done' | 'active' | 'locked' | 'coming' | 'testedOut';

export type Node =
  | { kind: 'lesson'; id: string; unit: string; title: string; state: LessonNodeState }
  | {
      kind: 'checkpoint';
      unit: string;
      title: string;
      state: 'active' | 'available' | 'passed' | 'coming';
    };

/**
 * One vertical list, exactly one active node while anything built is undone
 * (F-PA-1). When every lesson of a unit is complete but its checkpoint has not
 * been passed, the checkpoint itself is the active node -- the unit is not
 * finished until it is passed, so the next unit stays locked. A checkpoint of a built
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
    let cpState: Extract<Node, { kind: 'checkpoint' }>['state'];
    if (!u.built) cpState = 'coming';
    else if (passed) cpState = 'passed';
    else if (!activeAssigned && previousUnitPassed) {
      cpState = 'active';
      activeAssigned = true;
    } else cpState = 'available';
    out.push({ kind: 'checkpoint', unit: u.id, title: `${u.title} checkpoint`, state: cpState });
    previousUnitPassed = passed;
  }
  return out;
}

/** The one thing to do next: a lesson, or the checkpoint that now gates the unit. */
export function activeNode(p: Progress): Node | null {
  return pathNodes(p).find((n) => n.state === 'active') ?? null;
}

export function activeLesson(p: Progress): Extract<Node, { kind: 'lesson' }> | null {
  const n = activeNode(p);
  return n && n.kind === 'lesson' ? n : null;
}
