import type { Progress } from '@/data';
import { SECTIONS, unitById } from './curriculum';

export type LessonNodeState = 'done' | 'active' | 'locked' | 'coming' | 'testedOut';

export type Node =
  | {
      kind: 'lesson';
      id: string;
      section: string;
      unit: string;
      title: string;
      state: LessonNodeState;
    }
  | {
      kind: 'checkpoint';
      section: string;
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
  // Every section, in `SECTIONS` order, flattened into the one list the path
  // has always been. `activeAssigned` and `previousUnitPassed` carry across the
  // section boundary on purpose: 2.1 is gated by Section 1's last checkpoint
  // exactly as 1.2 is gated by 1.1's.
  const units = SECTIONS.flatMap((s) => s.units.map((u) => ({ section: s.id, u })));
  for (const { section, u } of units) {
    const passed = p.units[u.id]?.passed ?? false;
    for (const l of u.lessons) {
      if (!u.built) {
        out.push({ kind: 'lesson', id: l.id, section, unit: u.id, title: l.title, state: 'coming' });
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
      out.push({ kind: 'lesson', id: l.id, section, unit: u.id, title: l.title, state });
    }
    let cpState: Extract<Node, { kind: 'checkpoint' }>['state'];
    if (!u.built) cpState = 'coming';
    else if (passed) cpState = 'passed';
    else if (!activeAssigned && previousUnitPassed) {
      cpState = 'active';
      activeAssigned = true;
    } else cpState = 'available';
    out.push({
      kind: 'checkpoint',
      section,
      unit: u.id,
      title: `${u.title} checkpoint`,
      state: cpState,
    });
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

/**
 * NEUMORPHIC-DELTA.md §7.3: what Today's secondary column shows. All three
 * derivations below read the SAME projection the Path already reads -- no new
 * event type, no new store field, nothing persisted. If a figure cannot be
 * derived from `Progress` it is not shown (the day streak is the one the delta
 * asked for that cannot: `Progress` keeps `lastEventAt` and no per-day history,
 * so a streak would have to be invented).
 */

/** The n nodes that follow the active one, in path order. Empty when nothing is active. */
export function upcomingNodes(p: Progress, n: number): Node[] {
  const nodes = pathNodes(p);
  const i = nodes.findIndex((x) => x.state === 'active');
  if (i < 0) return [];
  return nodes.slice(i + 1, i + 1 + n);
}

export interface FinishedLesson {
  id: string;
  title: string;
  stars: 1 | 2 | 3;
}

/**
 * Finished lessons, most recent first.
 *
 * "Most recent" is REVERSE PATH ORDER, not a timestamp: the projection keeps no
 * completion time, and the path is strictly gated, so the last lesson a learner
 * finished is the last completed one in path order. A lesson skipped by testing
 * out is not listed -- it was passed, not finished, and it carries no stars.
 */
export function recentlyFinished(p: Progress, n: number): FinishedLesson[] {
  const out: FinishedLesson[] = [];
  for (const node of pathNodes(p)) {
    if (node.kind !== 'lesson' || node.state !== 'done') continue;
    const stars = p.lessons[node.id]?.stars;
    if (!stars) continue;
    out.push({ id: node.id, title: node.title, stars });
  }
  return out.reverse().slice(0, n);
}

/**
 * How far through the ACTIVE unit the learner is, counted in lessons for the
 * reason PathScreen counts them: a checkpoint is a gate on the work, not more
 * of it. Tested out counts as done. Null when nothing is active.
 */
export function activeUnitProgress(
  p: Progress,
): { unit: string; title: string; done: number; total: number } | null {
  const active = activeNode(p);
  if (!active) return null;
  const unit = unitById(active.unit);
  if (!unit) return null;
  const lessons = pathNodes(p).filter(
    (n): n is Extract<Node, { kind: 'lesson' }> => n.kind === 'lesson' && n.unit === unit.id,
  );
  return {
    unit: unit.id,
    title: unit.title,
    done: lessons.filter((n) => n.state === 'done' || n.state === 'testedOut').length,
    total: lessons.length,
  };
}
