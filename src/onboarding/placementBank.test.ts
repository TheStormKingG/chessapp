import { loadCheckpoint } from '@/lesson/loader';
import type { Challenge } from '@/lesson/types';
import { placeLearner, unitIndex, type UnitScore } from './placement';
import {
  PLACEMENT_LADDER,
  PLACEMENT_ROUNDS,
  RULES_CHECK,
  RULES_CHECK_SIZE,
  RUNG_SIZE,
  nextRung,
  pickRung,
  type PlacementRung,
  type RungOutcome,
} from './placementBank';

/** The rung's challenges as the app would get them: through the real loader. */
async function resolve(rung: PlacementRung): Promise<Challenge[]> {
  return pickRung(await loadCheckpoint(rung.unit), rung);
}

/**
 * Drive the adaptive rule to exhaustion with a fixed verdict per round.
 * Throws rather than looping for ever, so a rule that never returns null fails
 * as a test rather than as a timeout nobody attributes.
 */
function walk(verdict: (round: number, unit: string) => boolean): RungOutcome[] {
  const done: RungOutcome[] = [];
  for (;;) {
    const r = nextRung(done);
    if (!r) return done;
    done.push({ unit: r.unit, passed: verdict(done.length, r.unit) });
    if (done.length > 20) throw new Error('nextRung never returned null');
  }
}

/* ------------------------------------------------------- the manifest itself */

test('the ladder is longer than the round budget, so the adaptive rule has a choice', () => {
  expect(PLACEMENT_LADDER.length).toBeGreaterThan(PLACEMENT_ROUNDS);
  expect(PLACEMENT_ROUNDS * RUNG_SIZE).toBe(12);
  // F-ON-5: "12 to 15 challenges".
  expect(PLACEMENT_ROUNDS * RUNG_SIZE).toBeGreaterThanOrEqual(12);
  expect(PLACEMENT_ROUNDS * RUNG_SIZE).toBeLessThanOrEqual(15);
});

test('the ladder is in path order, so halving it means anything', () => {
  const indices = PLACEMENT_LADDER.map((r) => unitIndex(r.unit));
  expect(indices).not.toContain(-1);
  expect([...indices].sort((a, b) => a - b)).toEqual(indices);
  // Non-vacuous: the rungs really are different units spread over the path.
  expect(new Set(PLACEMENT_LADDER.map((r) => r.unit)).size).toBe(PLACEMENT_LADDER.length);
  expect(indices.at(-1)! - indices[0]!).toBeGreaterThan(10);
});

test('every ladder id resolves in its own unit’s checkpoint bank', async () => {
  const total = PLACEMENT_LADDER.reduce((n, r) => n + r.ids.length, 0);
  expect(total).toBe(PLACEMENT_LADDER.length * RUNG_SIZE);
  let resolved = 0;
  for (const rung of PLACEMENT_LADDER) {
    const picked = await resolve(rung);
    // Named, not merely counted: a bank that happened to hold three other
    // challenges would satisfy a count.
    expect(picked.map((c) => c.id)).toEqual(rung.ids);
    resolved += picked.length;
  }
  // The count is the positive control for the loop: had `PLACEMENT_LADDER` been
  // empty, every assertion inside it would have been skipped in silence.
  expect(resolved).toBe(total);
});

test('each rung asks three different ideas, and the ladder repeats none of them', async () => {
  const all: string[] = [];
  for (const rung of PLACEMENT_LADDER) {
    const picked = await resolve(rung);
    const concepts = picked.map((c) => c.concept);
    expect(concepts).toHaveLength(RUNG_SIZE);
    expect(new Set(concepts).size).toBe(RUNG_SIZE);
    all.push(...concepts);
  }
  // F-ON-5, "across themes": twenty-one questions, twenty-one ideas.
  expect(all).toHaveLength(PLACEMENT_LADDER.length * RUNG_SIZE);
  expect(new Set(all).size).toBe(all.length);
});

test('no placement challenge needs the engine, because the test runs before it is downloaded', async () => {
  const types: string[] = [];
  for (const rung of [...PLACEMENT_LADDER, ...RULES_CHECK]) {
    types.push(...(await resolve(rung)).map((c) => c.type));
  }
  expect(types.length).toBe(PLACEMENT_LADDER.length * RUNG_SIZE + RULES_CHECK_SIZE);
  expect(types).not.toContain('play_it_out');
  // The exclusion is real rather than a property of the corpus: the banks these
  // were drawn from DO carry that type, so it was filtered out, not absent.
  const bank = await loadCheckpoint('3.11');
  expect(bank.bank.some((c) => c.type === 'play_it_out')).toBe(true);
});

test('the rules check is five challenges over the three units that teach the rules', async () => {
  expect(RULES_CHECK_SIZE).toBe(5);
  expect(RULES_CHECK.map((r) => r.unit)).toEqual(['1.1', '1.3', '1.4']);
  const concepts: string[] = [];
  let resolved = 0;
  for (const rung of RULES_CHECK) {
    const picked = await resolve(rung);
    expect(picked.map((c) => c.id)).toEqual(rung.ids);
    concepts.push(...picked.map((c) => c.concept));
    resolved += picked.length;
  }
  expect(resolved).toBe(5);
  expect(new Set(concepts).size).toBe(5);
});

test('pickRung keeps manifest order and drops an id the bank does not hold', async () => {
  const bank = await loadCheckpoint('2.3');
  const real = PLACEMENT_LADDER.find((r) => r.unit === '2.3');
  expect(real).toBeDefined();
  // The positive control: the same call with the real ids finds all three, so
  // the empty result below is about the id and not about `pickRung`.
  expect(pickRung(bank, real!)).toHaveLength(RUNG_SIZE);
  expect(pickRung(bank, { unit: '2.3', ids: ['nope'] })).toEqual([]);
  const mixed = pickRung(bank, { unit: '2.3', ids: [real!.ids[1]!, 'nope', real!.ids[0]!] });
  expect(mixed.map((c) => c.id)).toEqual([real!.ids[1], real!.ids[0]]);
});

/* -------------------------------------------------------- the adaptive rule */

test('the first round probes the middle of the ladder', () => {
  const first = nextRung([]);
  expect(first?.unit).toBe(PLACEMENT_LADDER[Math.floor((PLACEMENT_LADDER.length - 1) / 2)]?.unit);
  expect(first?.unit).toBe('2.3');
});

test('clearing a rung moves up the ladder and missing one moves down', () => {
  const up = nextRung([{ unit: '2.3', passed: true }]);
  const down = nextRung([{ unit: '2.3', passed: false }]);
  expect(unitIndex(up!.unit)).toBeGreaterThan(unitIndex('2.3'));
  expect(unitIndex(down!.unit)).toBeLessThan(unitIndex('2.3'));
});

test('the search really halves: the probe sequence is the one a bisection makes', () => {
  // Pinned as exact sequences rather than as "moved up" / "moved down", because
  // an off-by-one in the interval's lower bound still moves in the right
  // direction and still visits four different units — it just probes the wrong
  // rung, which only an exact sequence can see.
  expect(walk(() => true).map((o) => o.unit)).toEqual(['2.3', '3.7', '3.11', '3.1']);
  expect(walk(() => false).map((o) => o.unit)).toEqual(['2.3', '1.3', '1.1', '2.1']);
  expect(walk((_, unit) => unit !== '2.1').map((o) => o.unit)).toEqual(['2.3', '3.7', '3.11', '3.1']);
});

test('once the boundary is known, a remaining round is spent BELOW it', () => {
  /*
   * 2.3 missed, then 1.3 and 2.1 cleared: the first failing rung is now known to
   * be 2.3 exactly, so the interval is closed and there is nothing left to
   * halve. The fourth round therefore looks for an EARLIER failure — the one
   * thing that could still change the placement — rather than confirming a
   * later one, which could not.
   */
  const done: RungOutcome[] = [
    { unit: '2.3', passed: false },
    { unit: '1.3', passed: true },
    { unit: '2.1', passed: true },
  ];
  const fourth = nextRung(done);
  expect(fourth).not.toBeNull();
  expect(unitIndex(fourth!.unit)).toBeLessThan(unitIndex('2.3'));
  expect(fourth!.unit).toBe('1.1');
  // Non-vacuous: unprobed rungs above 2.3 exist and were available to be
  // chosen, and one of them is exactly as far from the boundary as 1.1 is — so
  // this is the tie being broken downwards, not the only option left.
  const above = PLACEMENT_LADDER.filter((r) => unitIndex(r.unit) > unitIndex('2.3'));
  expect(above.map((r) => r.unit)).toEqual(['3.1', '3.7', '3.11']);
});

test('the test stops after the round budget and never repeats a unit', () => {
  for (const mask of Array.from({ length: 1 << PLACEMENT_ROUNDS }, (_, i) => i)) {
    const done = walk((round) => ((mask >> round) & 1) === 1);
    expect(done).toHaveLength(PLACEMENT_ROUNDS);
    expect(new Set(done.map((o) => o.unit)).size).toBe(PLACEMENT_ROUNDS);
    expect(nextRung(done)).toBeNull();
  }
});

test('an outcome for a unit outside the ladder cannot move the search', () => {
  expect(nextRung([{ unit: '9.9', passed: false }])?.unit).toBe(nextRung([])?.unit);
});

/* ------------------------------------------- bank and rule, end to end */

test('every reachable run asks twelve challenges across four units and twelve ideas', async () => {
  const placements = new Set<string>();
  for (const mask of Array.from({ length: 1 << PLACEMENT_ROUNDS }, (_, i) => i)) {
    const done = walk((round) => ((mask >> round) & 1) === 1);
    const scores: UnitScore[] = [];
    const concepts: string[] = [];
    for (const o of done) {
      const rung = PLACEMENT_LADDER.find((r) => r.unit === o.unit);
      expect(rung).toBeDefined();
      const picked = await resolve(rung!);
      expect(picked).toHaveLength(RUNG_SIZE);
      concepts.push(...picked.map((c) => c.concept));
      // The verdict, expressed as a score the placement rule can read: a clear
      // pass is three of three, a miss is one of three.
      scores.push({ unit: o.unit, scored: o.passed ? 3 : 1, asked: RUNG_SIZE });
    }
    expect(concepts).toHaveLength(12);
    expect(new Set(concepts).size).toBe(12);
    placements.add(placeLearner(scores).unit);
  }
  // Non-vacuous: the sixteen runs really do place learners in different places,
  // including both ends — a rule that always answered '1.1' would satisfy every
  // assertion above.
  expect(placements.size).toBeGreaterThan(3);
  expect(placements).toContain('1.1');
  expect(placements).toContain('4.1');
});
