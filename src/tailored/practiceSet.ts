import type { Challenge } from '@/lesson';
import type { Puzzle, PuzzleRating, Theme as PuzzleTheme } from '@/puzzles/types';
import type { LearnerEvent } from '@/data/events';
import type { OwnCandidate } from './ownPositions';
import { type PassRate, type Verdict, passRate } from './verify';

/**
 * F-TS-4, "The practice set", verbatim:
 *
 * > "Six to ten puzzles, own positions first, then similar positions from the
 * > concept bank, interleaved with one or two puzzles from a strength so the learner
 * > is not told what to look for every time. Positions that the engine cannot verify
 * > as single-answer are shown as 'play it out' drills instead."
 *
 * ── THE ONE PLACE THE OPPONENT'S MOVE IS REPLAYED LITERALLY ──────────────────
 *
 * A `Puzzle` carries a move list and `PuzzlePlayer` plays `solution[0]` before
 * handing the board over, so an own position starts one ply earlier and the board
 * makes the opponent's move. `firstLearnerPly` says which ply is the learner's and is
 * explicit for the reason `PuzzlePlayer` documents: guessing it asks the learner to
 * play the wrong side and every position still looks legal.
 *
 * ── "FROM A STRENGTH" IS HONOURED AS FAR AS THE DATA ALLOWS ──────────────────
 *
 * A `Strength` (src/profile/strengths.ts) carries a REVIEW theme in `evidence`, and
 * only one review theme has a counterpart among the eight motifs the packs are
 * filtered on: `missed_mate` → `mateIn1`. src/puzzles/queue.ts explains at length
 * why the other three must not be mapped onto a motif — they are habits the
 * curriculum teaches, not motifs the packs carry, and a mapping points the drill at
 * the wrong idea.
 *
 * So a strength puzzle is drawn from a theme the learner has actually solved, when
 * one is known; otherwise the interleaved puzzle is drawn from a theme that is simply
 * NOT the one being drilled, and it is labelled `contrast` rather than `strength`.
 * That serves the clause's stated purpose — "so the learner is not told what to look
 * for every time" — without the screen claiming a provenance it does not have.
 */

export const MIN_SET = 6;
export const MAX_SET = 10;
/** F-TS-4's "one or two". */
export const STRENGTH_SLOTS = 2;
/** The size a set aims for when there is enough material. */
export const DEFAULT_SET = 8;
/** F-PZ-3's "a puzzle rating within 150 points", reused for "similar". */
export const SIMILAR_RATING_SPAN = 150;
/** How many moves a "play it out" fallback asks the learner to hold. */
export const PLAY_IT_OUT_MOVES = 6;

/**
 * The puzzle motif a review theme drills, where one exists. Deliberately the same
 * relation as `DRILL_THEME` in src/puzzles/queue.ts, and deliberately as narrow.
 */
export const DRILL_THEME: Record<string, PuzzleTheme | null> = {
  missed_mate: 'mateIn1',
  hung_piece: null,
  missed_capture: null,
  ignored_threat: null,
  unclassified: null,
};

export type ItemOrigin = 'own' | 'similar' | 'strength' | 'contrast';

export type PracticeItem =
  | {
      kind: 'puzzle';
      puzzle: Puzzle;
      firstLearnerPly: 0 | 1;
      origin: ItemOrigin;
      /** F-TS-3's game reference, for an own position. Null for a pack puzzle. */
      provenance: string | null;
    }
  | {
      kind: 'play-it-out';
      challenge: Extract<Challenge, { type: 'play_it_out' }>;
      origin: 'own';
      provenance: string;
    };

export interface PracticeSet {
  items: PracticeItem[];
  /** Verification over the own candidates offered to the engine. */
  rate: PassRate;
  /** Why the set is short, when it is shorter than MIN_SET. Null when it is not. */
  short: string | null;
}

/** An own position the engine certified: the learner is to move, one answer. */
export function ownPuzzle(c: OwnCandidate, rating: number): { puzzle: Puzzle; firstLearnerPly: 0 | 1 } {
  const theme = DRILL_THEME[c.theme] ?? null;
  if (c.lead) {
    return {
      puzzle: {
        id: `own:${c.gameId}:${String(c.ply)}`,
        fen: c.lead.fen,
        // The opponent's move, then the learner's answer. This is F-TS-3's "with the
        // opponent's move replayed", literally.
        solution: [c.lead.uci, c.bestUci],
        // The position has no rating of its own; the learner's own is the least
        // distorting stand-in, exactly as src/puzzles/queue.ts argues.
        rating,
        themes: theme ? [theme] : [],
      },
      firstLearnerPly: 1,
    };
  }
  return {
    puzzle: {
      id: `own:${c.gameId}:${String(c.ply)}`,
      fen: c.fen,
      solution: [c.bestUci],
      rating,
      themes: theme ? [theme] : [],
    },
    firstLearnerPly: 0,
  };
}

/** F-TS-4's fallback for a position the engine would not certify. */
export function playItOutDrill(c: OwnCandidate): Extract<Challenge, { type: 'play_it_out' }> {
  return {
    type: 'play_it_out',
    id: `out-${c.gameId}-${String(c.ply)}`,
    fen: c.fen,
    prompt: `This one has no single answer. Play it out from here and hold the position for ${String(PLAY_IT_OUT_MOVES)} moves.`,
    concept: 'own-position',
    // `hold`: survive the moves without being mated and without letting a pawn
    // through. The other three goals make a claim about the position — that a mate
    // or a promotion is there — which is exactly what the engine just declined to
    // certify.
    goal: { kind: 'hold', moves: PLAY_IT_OUT_MOVES },
    reason: `From ${c.provenance}. You played ${c.playedSan} here.`,
  };
}

/** Puzzle themes the learner has solved, newest first, from the event log. */
export function solvedThemes(events: readonly LearnerEvent[]): PuzzleTheme[] {
  const out: PuzzleTheme[] = [];
  const seen = new Set<string>();
  for (const e of [...events].reverse()) {
    const p = e.payload;
    if (p.type !== 'puzzle_attempted' || !p.solved) continue;
    for (const t of p.themes) {
      if (seen.has(t)) continue;
      seen.add(t);
      out.push(t as PuzzleTheme);
    }
  }
  return out;
}

export interface PracticeInput {
  candidates: readonly OwnCandidate[];
  /** The theme being drilled, as a review theme. */
  theme: string;
  /** Pack puzzles at the learner's band. May be empty when the pack did not load. */
  pool: readonly Puzzle[];
  rating: PuzzleRating;
  /** Puzzle ids the learner has already seen (F-PZ-1). */
  seen: ReadonlySet<string>;
  /** Themes the learner has solved, for F-TS-4's interleaved puzzle. */
  strengths: readonly PuzzleTheme[];
  verify: (at: { fen: string; expectedUci: string }) => Promise<Verdict>;
  /** Target size. Clamped to F-TS-4's six-to-ten. */
  size?: number;
}

function clamp(n: number): number {
  return Math.min(MAX_SET, Math.max(MIN_SET, n));
}

/** Pack puzzles near the learner's rating, nearest first, unseen. */
function similar(input: PracticeInput, theme: PuzzleTheme | null, used: ReadonlySet<string>): Puzzle[] {
  const r = input.rating.rating;
  return input.pool
    .filter(
      (p) =>
        !input.seen.has(p.id) &&
        !used.has(p.id) &&
        Math.abs(p.rating - r) <= SIMILAR_RATING_SPAN &&
        (theme === null || p.themes.includes(theme)),
    )
    .sort((a, b) => Math.abs(a.rating - r) - Math.abs(b.rating - r));
}

export async function buildPracticeSet(input: PracticeInput): Promise<PracticeSet> {
  const size = clamp(input.size ?? DEFAULT_SET);
  const drillTheme = DRILL_THEME[input.theme] ?? null;

  // 1. Own positions, each through the engine gate.
  //
  // Capped so F-TS-4's interleaved puzzles have somewhere to go: a set that is
  // entirely own positions tells the learner what to look for every time, which is
  // the thing the clause exists to prevent. The cap lifts when there is no pack to
  // interleave FROM — six of the learner's own positions beat four of them.
  const ownCap = input.pool.length > 0 ? Math.max(1, size - STRENGTH_SLOTS) : size;
  const verdicts: Verdict[] = [];
  const own: PracticeItem[] = [];
  for (const c of input.candidates) {
    if (own.length >= ownCap) break;
    const v = await input.verify({ fen: c.fen, expectedUci: c.bestUci });
    verdicts.push(v);
    if (v.verified) {
      const { puzzle, firstLearnerPly } = ownPuzzle(c, input.rating.rating);
      own.push({ kind: 'puzzle', puzzle, firstLearnerPly, origin: 'own', provenance: c.provenance });
    } else {
      // F-TS-4, in as many words: an unverifiable position becomes a drill rather
      // than being dropped. The learner's own mistake is still the material.
      own.push({ kind: 'play-it-out', challenge: playItOutDrill(c), origin: 'own', provenance: c.provenance });
    }
  }

  const used = new Set(own.map((i) => (i.kind === 'puzzle' ? i.puzzle.id : i.challenge.id)));

  // 2. The interleaved puzzles: a strength the learner has solved, else a contrast.
  const strengthTheme = input.strengths.find((t) => t !== drillTheme) ?? null;
  const strengthPool = strengthTheme === null ? [] : similar(input, strengthTheme, used);
  const contrastPool =
    strengthPool.length > 0
      ? []
      : similar(input, null, used).filter((p) => drillTheme === null || !p.themes.includes(drillTheme));
  const interleaved: PracticeItem[] = [...strengthPool, ...contrastPool].slice(0, STRENGTH_SLOTS).map((puzzle) => ({
    kind: 'puzzle' as const,
    puzzle,
    firstLearnerPly: 1 as const,
    origin: strengthPool.length > 0 ? ('strength' as const) : ('contrast' as const),
    provenance: null,
  }));
  for (const i of interleaved) if (i.kind === 'puzzle') used.add(i.puzzle.id);

  // 3. Similar positions from the pack, to fill.
  const fill: PracticeItem[] = similar(input, drillTheme, used)
    .slice(0, Math.max(0, size - own.length - interleaved.length))
    .map((puzzle) => ({ kind: 'puzzle' as const, puzzle, firstLearnerPly: 1 as const, origin: 'similar' as const, provenance: null }));

  // Own first, then the fill, with the interleaved puzzles spaced through the tail
  // rather than bunched at the end: the point of them is that the learner cannot
  // assume every position is about the same idea.
  const tail = [...fill];
  const items = [...own];
  for (const [n, extra] of interleaved.entries()) {
    const at = Math.min(tail.length, Math.floor(((n + 1) * tail.length) / (interleaved.length + 1)));
    tail.splice(at + n, 0, extra);
  }
  items.push(...tail);

  const total = items.length;
  return {
    items,
    rate: passRate(verdicts),
    short:
      total >= MIN_SET
        ? null
        : `Only ${String(total)} of ${String(MIN_SET)} positions were available: ${
            input.pool.length === 0 ? 'the puzzle pack could not be loaded' : 'there are not enough of your own positions yet'
          }.`,
  };
}
