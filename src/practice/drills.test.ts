import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  CATEGORY_TITLE,
  DRILLS,
  DRILL_CATEGORIES,
  GOAL_LABEL,
  drillKey,
  drillsIn,
  findDrill,
  groupsIn,
  parLabel,
  type DrillCategory,
} from './drills';
import { unitById } from '@/path/curriculum';

/**
 * `DRILLS` is an index over content, so the test that matters is whether the
 * index and the content still agree — in BOTH directions. One direction alone is
 * a half-check: "every entry exists" passes an index missing half the drills, and
 * "every drill is indexed" passes an index full of wrong pars.
 *
 * ── THE SWEEP IS MEMOISED AND CARRIES ITS OWN TIMEOUT ────────────────────────
 *
 * It parses every lesson file in `content/`, and the cost is a function of the
 * corpus, not of this feature. src/lesson/concepts.test.ts crossed vitest's
 * 5,000 ms default doing exactly this at 204 files — and only in a run with other
 * files competing for the machine, so it looked like flake and was not. Same
 * remedy here: parse once for the whole file, and state a raised timeout on the
 * test that does the parsing rather than leaving a future reader to discover the
 * budget by crossing it.
 */

interface ContentDrill {
  file: string;
  lessonId: string;
  unit: string;
  title: string;
  challengeId: string;
  goal: string;
  par: number;
  concept: string | undefined;
}

let cache: ContentDrill[] | null = null;

function lessonFiles(dir = 'content', out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'schema') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) lessonFiles(p, out);
    else if (/lesson-[\d.]+\.json$/.test(p)) out.push(p);
  }
  return out;
}

/** Every `play_it_out` challenge in content, read once per test file. */
function contentDrills(): ContentDrill[] {
  if (cache) return cache;
  const found: ContentDrill[] = [];
  const files = lessonFiles();
  // The non-empty control for the sweep itself: a walk that found nothing would
  // make every "both directions agree" assertion below pass vacuously.
  expect(files.length).toBeGreaterThan(100);
  for (const file of files) {
    const doc = JSON.parse(readFileSync(file, 'utf8')) as {
      id: string;
      unit: string;
      title: string;
      challenges?: { id: string; type: string; goal?: { kind: string; moves: number }; concept?: string }[];
    };
    for (const c of doc.challenges ?? []) {
      if (c.type !== 'play_it_out') continue;
      found.push({
        file,
        lessonId: doc.id,
        unit: doc.unit,
        title: doc.title,
        challengeId: c.id,
        goal: c.goal!.kind,
        par: c.goal!.moves,
        concept: c.concept,
      });
    }
  }
  cache = found;
  return found;
}

describe('the drill index agrees with content', () => {
  it(
    'indexes every play_it_out challenge in content, and nothing that is not one',
    () => {
      const inContent = contentDrills();
      // The control: content really does contain drills to index.
      expect(inContent.length).toBeGreaterThan(0);

      const contentKeys = inContent.map((d) => `${d.lessonId}/${d.challengeId}`).sort();
      const indexKeys = DRILLS.map(drillKey).sort();

      // Both directions in one assertion: a set equality catches a missing entry
      // and a stale one, and names which in the diff.
      expect(indexKeys).toEqual(contentKeys);
    },
    /*
     * A raised timeout, not a flake tolerated — the same call src/path/builtFlag.test.ts
     * and src/lesson/concepts.test.ts both make, and for the same reason. This test
     * parses every lesson file in content/, so its cost is a function of the corpus
     * and grows with every unit that ships. Against vitest's 5s default,
     * concepts.test.ts crossed the line at 204 files while agents were saturating
     * the machine and passed on every re-run in isolation, which is the signature of
     * a budget rather than a defect. The work is real: reading everything IS the
     * assertion, so the budget moves and the scope does not.
     */
    20_000,
  );

  it('records the same goal, par, unit and title as the content it points at', () => {
    const byKey = new Map(contentDrills().map((d) => [`${d.lessonId}/${d.challengeId}`, d]));
    for (const drill of DRILLS) {
      const actual = byKey.get(drillKey(drill));
      expect(actual, `no content drill for ${drillKey(drill)}`).toBeDefined();
      expect(drill.goal).toBe(actual!.goal);
      // Par is the content's own move budget, not a number this file chose.
      expect(drill.par).toBe(actual!.par);
      expect(drill.unit).toBe(actual!.unit);
      expect(drill.title).toBe(actual!.title);
      expect(drill.concept).toBe(actual!.concept);
    }
  });

  it('points only at lessons the curriculum knows about', () => {
    for (const drill of DRILLS) {
      const unit = unitById(drill.unit);
      expect(unit, `curriculum has no unit ${drill.unit}`).toBeDefined();
      expect(unit!.lessons.map((l) => l.id)).toContain(drill.lessonId);
    }
  });

  it('gives every drill a distinct key, including the two in lesson 1.5.1', () => {
    const keys = DRILLS.map(drillKey);
    expect(new Set(keys).size).toBe(keys.length);
    // The positive control: 1.5.1 genuinely has two drills, so the uniqueness
    // above is doing work rather than describing a list of one-per-lesson.
    expect(DRILLS.filter((d) => d.lessonId === '1.5.1')).toHaveLength(2);
  });
});

describe("F-PR-1's categories", () => {
  it('has all four, in the order the requirement lists them', () => {
    expect(DRILL_CATEGORIES).toEqual(['mates', 'motifs', 'endgames', 'mini-games']);
  });

  it('files every drill under exactly one of them', () => {
    const counted = DRILL_CATEGORIES.reduce((n, c) => n + drillsIn(c).length, 0);
    expect(counted).toBe(DRILLS.length);
    for (const drill of DRILLS) expect(DRILL_CATEGORIES).toContain(drill.category);
  });

  it('leaves no category empty, so the tab renders no blank heading', () => {
    for (const category of DRILL_CATEGORIES) {
      expect(drillsIn(category).length, `${category} has no drills`).toBeGreaterThan(0);
      expect(groupsIn(category).length).toBeGreaterThan(0);
      expect(CATEGORY_TITLE[category]).toBeTruthy();
    }
  });

  it('puts the piece checkmates under mates and the rest of Section 1 under mini-games', () => {
    // The two named cases the categorisation rule exists to get right.
    expect(DRILLS.filter((d) => d.unit === '1.5').every((d) => d.category === 'mates')).toBe(true);
    expect(
      DRILLS.filter((d) => d.unit.startsWith('1.') && d.unit !== '1.5').every((d) => d.category === 'mini-games'),
    ).toBe(true);
  });
});

describe('what a card shows (F-PR-1: a goal, a par and stars)', () => {
  it('has a goal label for every goal kind that occurs', () => {
    for (const drill of DRILLS) {
      expect(GOAL_LABEL[drill.goal]).toBeTruthy();
    }
    // The control: all four kinds are actually in use, so the record above is
    // exercised rather than merely complete.
    expect(new Set(DRILLS.map((d) => d.goal))).toEqual(new Set(['mate_in', 'promote', 'capture_all', 'hold']));
  });

  it('words par so a hold drill cannot be read as a limit', () => {
    const hold = DRILLS.find((d) => d.goal === 'hold')!;
    const mate = DRILLS.find((d) => d.goal === 'mate_in')!;
    expect(parLabel(hold)).toBe(`Survive ${String(hold.par)} moves`);
    expect(parLabel(mate)).toMatch(/^Within /);
    // The same number reads two ways, which is the whole reason for the function.
    expect(parLabel(hold)).not.toBe(parLabel({ ...hold, goal: 'mate_in' }));
  });

  it('says "1 move" rather than "1 moves"', () => {
    const one = DRILLS.find((d) => d.par === 1);
    expect(one, 'no drill with a par of 1 to check the singular against').toBeDefined();
    expect(parLabel(one!)).toContain('1 move');
    expect(parLabel(one!)).not.toContain('1 moves');
  });
});

describe('findDrill', () => {
  it('finds a drill by its lesson and challenge', () => {
    const first = DRILLS[0]!;
    expect(findDrill(first.lessonId, first.challengeId)).toEqual(first);
  });

  it('tells the two drills of lesson 1.5.1 apart', () => {
    const both = DRILLS.filter((d) => d.lessonId === '1.5.1');
    expect(findDrill('1.5.1', both[0]!.challengeId)).toEqual(both[0]);
    expect(findDrill('1.5.1', both[1]!.challengeId)).toEqual(both[1]);
    expect(both[0]!.par).not.toBe(both[1]!.par);
  });

  it('returns null for anything it does not have', () => {
    expect(findDrill('9.9.9', 'nope')).toBeNull();
    expect(findDrill(undefined, undefined)).toBeNull();
    expect(findDrill('1.5.1', undefined)).toBeNull();
    // A real lesson with a challenge id from a DIFFERENT lesson must not match.
    expect(findDrill('1.5.1', DRILLS.find((d) => d.lessonId === '2.7.1')!.challengeId)).toBeNull();
  });
});

describe('drillsIn and groupsIn', () => {
  it('returns the drills of that category only', () => {
    for (const category of DRILL_CATEGORIES) {
      expect(drillsIn(category).every((d) => d.category === category)).toBe(true);
    }
  });

  it('lists each group once, in first-appearance order', () => {
    const groups = groupsIn('endgames' as DrillCategory);
    expect(new Set(groups).size).toBe(groups.length);
    expect(groups[0]).toBe(drillsIn('endgames').at(0)!.group);
    // The control: endgames has more than one group, so "once each" is tested.
    expect(groups.length).toBeGreaterThan(1);
  });
});
