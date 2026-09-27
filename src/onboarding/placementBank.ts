import type { Challenge, CheckpointBank } from '@/lesson/types';

/**
 * The placement bank, and the adaptive rule that walks it (PRD 8.1 F-ON-5).
 *
 * ── WHERE THE CHALLENGES COME FROM ──────────────────────────────────────────
 *
 * Nothing here is new content. The corpus already holds 1,715 verified
 * challenges, every one carrying a `concept` and belonging to a unit, and every
 * unit's held-out checkpoint bank is exactly the "positions you have not seen"
 * a placement test needs. So the ladder below is a MANIFEST of ids drawn from
 * those banks: unit ids and challenge ids, a few hundred bytes of strings, no
 * positions and no prose.
 *
 * Selection rule, applied to each rung's unit and reproducible from it:
 *
 *   1. Drop every `play_it_out` challenge. That type mounts `EngineGate` and
 *      downloads Stockfish (F-OF-2), and the placement test runs on a first
 *      launch, before any engine is on the device. A placement question that
 *      cannot be answered offline is not a placement question.
 *   2. Walk the bank in its own order and take the first challenge of each
 *      CONCEPT not already taken, preferring one whose challenge TYPE is also
 *      new to the rung, until three are held.
 *   3. Skip a concept already used by an earlier rung, so the twelve questions
 *      of a run are twelve different ideas rather than the same idea at four
 *      difficulties — F-ON-5's "across themes".
 *
 * That yields three distinct concepts and (here) three distinct types per rung,
 * twenty-one distinct concepts across the ladder. `placementBank.test.ts`
 * re-derives all three properties from the real banks, so a content edit that
 * renames or removes one of these ids fails the suite rather than silently
 * shortening the test.
 *
 * ── WHY THIS DOES NOT LOAD THE CORPUS ───────────────────────────────────────
 *
 * `loadCheckpoint` is a per-file dynamic import (`lesson/loader.ts`), so a rung
 * fetches ONE unit's checkpoint JSON when that rung is reached and never
 * before. A run probes four rungs, so it loads four files out of thirty-one,
 * and the three question screens ahead of it load none. The ladder module
 * itself carries no content at all, which is the same reasoning
 * `TodayScreen.tsx` records for not fetching a pack to label a card: the launch
 * screen must not pay for a feature the learner has not opened.
 *
 * ── THE ADAPTIVE RULE ───────────────────────────────────────────────────────
 *
 * The unknown is the FIRST rung the learner fails, and the rungs are ordered,
 * so the cheapest way to find it is to halve the interval it lies in. Four
 * rounds of three is twelve challenges, inside F-ON-5's "12 to 15", and four
 * probes resolve a seven-rung interval with a round to spare — which is spent
 * BELOW the boundary, looking for an earlier failure the halving assumed away.
 * See `nextRung`.
 */

export interface PlacementRung {
  /** The unit this rung probes, and the unit its challenges are tagged to. */
  unit: string;
  /** Challenge ids, in that unit's own checkpoint bank. */
  ids: readonly string[];
}

/** F-ON-5: three challenges per rung, four rounds, twelve challenges. */
export const RUNG_SIZE = 3;
export const PLACEMENT_ROUNDS = 4;

/**
 * The ladder, in path order. Seven rungs spanning 1.1 to 3.11: a run visits
 * four of them, and an all-pass lands on the Section 4 cap (`placement.ts`)
 * rather than needing a rung there.
 */
export const PLACEMENT_LADDER: readonly PlacementRung[] = [
  // square-names, rook-moves, bishop-moves
  { unit: '1.1', ids: ['1.1-cp-sq1', '1.1-cp-r1', '1.1-cp-b3'] },
  // check, escape-check, checkmate
  { unit: '1.3', ids: ['1.3-k01', '1.3-k08', '1.3-k15'] },
  // opponent-threats, threat-scan, hanging-both-sides
  { unit: '2.1', ids: ['2.1-k01', '2.1-k08', '2.1-k19'] },
  // absolute-pin, relative-pin, pin-both-sides
  { unit: '2.3', ids: ['2.3-k01', '2.3-k10', '2.3-k16'] },
  // removing-the-defender, overloading, exploit-pin
  { unit: '3.1', ids: ['3.1-k01', '3.1-k11', '3.1-k23'] },
  // open-file, rook-on-seventh, passed-pawn
  { unit: '3.7', ids: ['3.7-k01', '3.7-k10', '3.7-k20'] },
  // candidate-moves, forcing-line, blunder-check
  { unit: '3.11', ids: ['3.11-k01', '3.11-k16', '3.11-k23'] },
];

/**
 * F-ON-5's five-challenge rules check, drawn the same way from the three units
 * that teach the rules themselves: the board and the pieces (1.1), check, mate
 * and draws (1.3), and castling and the rules of play (1.4).
 *
 * Five, not six, so the split is 2 + 2 + 1 rather than even. The uneven rung is
 * 1.4 because its unit is the smallest of the three and its one concept —
 * what castling is not allowed to do — is the rule most often misremembered by
 * someone who says they know the rules.
 */
export const RULES_CHECK: readonly PlacementRung[] = [
  { unit: '1.1', ids: ['1.1-cp-sq1', '1.1-cp-r1'] },
  { unit: '1.3', ids: ['1.3-k01', '1.3-k08'] },
  { unit: '1.4', ids: ['1.4-k01'] },
];

/** How many challenges the rules check asks. */
export const RULES_CHECK_SIZE = RULES_CHECK.reduce((n, r) => n + r.ids.length, 0);

/** One rung's verdict: did the learner clear the bar on it. */
export interface RungOutcome {
  unit: string;
  passed: boolean;
}

/**
 * The interval the first failing rung lies in, given what has been answered.
 *
 * `lo` is the lowest index it could still be; `hi` is the lowest index known to
 * have failed, or `length` for "possibly none of them". An out-of-ladder unit is
 * ignored rather than trusted, so a stale outcome cannot move the interval.
 */
function bracket(done: readonly RungOutcome[]): { lo: number; hi: number } {
  let lo = 0;
  let hi = PLACEMENT_LADDER.length;
  for (const o of done) {
    const i = PLACEMENT_LADDER.findIndex((r) => r.unit === o.unit);
    if (i < 0) continue;
    if (o.passed) lo = Math.max(lo, i + 1);
    else hi = Math.min(hi, i);
  }
  return { lo, hi };
}

/**
 * The next rung to ask, or null when the test is over.
 *
 * Two cases, and the second is the one worth reading twice:
 *
 *   - The interval is still open. Probe its middle, because that halves it
 *     whichever way the answer goes.
 *   - The interval is closed — the first failing rung is known — but rounds
 *     remain. Probe just BELOW the boundary instead. Halving assumes the
 *     learner's results are monotonic, and they are not: a learner can clear
 *     pins and miss check. An unprobed lower rung is the only thing left that
 *     could still change the placement, and F-ON-5 asks for the FIRST unit
 *     under the bar, not the first one the search happened to find.
 *
 * On a tie in distance the lower rung wins, for the same reason `placeLearner`
 * breaks a score tie downwards: a revision costs less than a missing lesson.
 */
export function nextRung(done: readonly RungOutcome[]): PlacementRung | null {
  if (done.length >= PLACEMENT_ROUNDS) return null;
  const probed = new Set(done.map((o) => o.unit));
  const unprobed = PLACEMENT_LADDER.map((r, i) => ({ r, i })).filter((x) => !probed.has(x.r.unit));
  const first = unprobed[0];
  // A ladder shorter than the round budget runs out of rungs before rounds.
  if (!first) return null;

  const last = PLACEMENT_LADDER.length - 1;
  const { lo, hi } = bracket(done);
  const target =
    lo >= hi
      ? Math.min(Math.max(hi - 1, 0), last)
      : Math.floor((lo + Math.min(hi, last)) / 2);

  let best = first;
  for (const x of unprobed) {
    const d = Math.abs(x.i - target);
    const bd = Math.abs(best.i - target);
    if (d < bd || (d === bd && x.i < best.i)) best = x;
  }
  return best.r;
}

/**
 * The rung's challenges, in manifest order, from the unit's loaded bank.
 *
 * A missing id is dropped rather than substituted. There is deliberately no
 * fall-back to another challenge: the manifest is pinned by
 * `placementBank.test.ts` against the real banks, so a missing id is a content
 * change that has to be seen, and a silent substitution is exactly what would
 * stop it being seen. The round would be short, and the scoring divides by what
 * was actually asked (`scoreUnit`), so a short round scores honestly.
 */
export function pickRung(bank: CheckpointBank, rung: PlacementRung): Challenge[] {
  const byId = new Map(bank.bank.map((c) => [c.id, c]));
  return rung.ids.flatMap((id) => {
    const c = byId.get(id);
    return c ? [c] : [];
  });
}
