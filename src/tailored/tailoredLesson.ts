import type { Challenge, CheckpointBank, Lesson } from '@/lesson';
import type { OwnCandidate } from './ownPositions';
import { type PassRate, type Verdict, passRate } from './verify';

/**
 * F-TS-3, "The tailored lesson", verbatim:
 *
 * > "The lesson that teaches the weakness is reassembled with the learner's own
 * > positions. The lesson card and explain screens stay as authored. The challenges
 * > are drawn first from the learner's own games (the position before the mistake,
 * > with the opponent's move replayed, verified by the engine to have a single clear
 * > answer), then from the concept bank at the learner's difficulty. The coach's
 * > feedback names the game ('This is from your game against Rosa on Tuesday'). If a
 * > learner has already completed the lesson on the path, the tailored version counts
 * > as a review lesson."
 *
 * ── WHAT IS REASSEMBLED, AND WHAT IS NOT TOUCHED ─────────────────────────────
 *
 * `card`, `explain`, `title`, `takeaway` and `xp` are carried across byte for byte.
 * Only `challenges` is replaced. That is the requirement, and it is also what makes
 * this safe: the authored teaching is the part a runtime assembler has no business
 * rewriting.
 *
 * ── THE CONCEPT BANK ─────────────────────────────────────────────────────────
 *
 * There is no module called a concept bank. The pool that answers to the
 * description is the unit's `CheckpointBank.bank`: positions authored for the same
 * unit, at the same difficulty, which PRD 6.4 holds out so the learner has not seen
 * them. `remediationSet` in src/checkpoint/ already draws from it by concept, which
 * is the same relation this needs. Filtered to the concepts the authored lesson
 * actually teaches, so a "tailored forks lesson" cannot fill itself with back-rank
 * positions that happen to share the unit.
 *
 * The authored lesson's own challenges are the last resort. A tailored lesson that
 * ran short would be a worse lesson than the one on the path, and F-TS-3's promise
 * is a different lesson, not a thinner one.
 *
 * ── THE IDS ──────────────────────────────────────────────────────────────────
 *
 * `LessonPlayer` keys a challenge's mount on its id, and `LessonMachine` keys every
 * result on it, so a duplicate id silently merges two challenges' results. Own
 * challenges are named for the game and ply they came from, which is unique by
 * construction; bank and authored challenges keep the ids they were authored with,
 * which the corpus verifier already guarantees are unique within a file. The
 * assembled lesson's own id is prefixed, so nothing keys resume state or progress on
 * a lesson that exists only in memory.
 */

export const TAILORED_ID_PREFIX = 'tailored:';

/** The FixItDrill vocabulary, reused so one learner hears one voice. */
const THEME_PROMPT: Record<string, string> = {
  hung_piece: 'You left a piece to be taken here. Find the move that keeps it.',
  missed_capture: 'Something was free here. Take it.',
  missed_mate: 'There is a checkmate in one. Find it.',
  ignored_threat: 'Your opponent was threatening something. Deal with it.',
};

const FALLBACK_PROMPT = 'There was a better move here. Find it.';

export interface TailoredLesson {
  /** The assembled lesson, ready for `LessonPlayer`. */
  lesson: Lesson;
  /** The authored lesson this was built from — the id events are recorded against. */
  authoredId: string;
  own: number;
  fromBank: number;
  fromAuthored: number;
  /** Verification over the own candidates that were offered to the engine. */
  rate: PassRate;
  /**
   * Own positions the engine would not certify as single-answer. F-TS-4 turns these
   * into "play it out" drills, so they are handed back rather than dropped.
   */
  unverified: OwnCandidate[];
}

/** One own position, as a lesson challenge. */
export function ownChallenge(c: OwnCandidate, concept: string): Challenge {
  // F-TS-3's "with the opponent's move replayed". A lesson `Challenge` carries one
  // FEN and no move to play first — the eight types are a closed union whose every
  // consumer switches exhaustively — so the move is STATED over the position it
  // produced, which is exactly how the authored corpus does it (see `2.1.1-c6`:
  // "Black has just played the queen to d5"). src/tailored/ownPositions.ts records
  // why, and the practice set replays it literally because a `Puzzle` can.
  const lead = c.lead ? `Your opponent has just played ${c.lead.san}. ` : '';
  return {
    type: 'find_the_move',
    id: `own-${c.gameId}-${String(c.ply)}`,
    fen: c.fen,
    prompt: `${lead}${THEME_PROMPT[c.theme] ?? FALLBACK_PROMPT}`,
    // The authored lesson's concept, not the error-log theme. `concept` is a closed
    // enum in content/schema/lesson.schema.json and `CheckpointMachine` groups by
    // it; a theme id there would be a value nothing else in the vocabulary knows.
    concept,
    // SAN, and ONLY SAN.
    //
    // `checkAnswer` maps every entry in `answer.moves` through `sanOf(c.fen, …)`
    // before comparing, and an attempt always arrives as a UCI, so listing the same
    // move in both notations adds nothing a test can distinguish — a mutation run
    // confirmed the UCI entry could be deleted without a single assertion noticing.
    // What the notation DOES decide is the wording: `revealText` prints
    // `answer.moves[0]` verbatim, so a UCI here tells the learner "The answer is
    // f2f3." This module's suite drives the real reducer to a reveal to pin that.
    //
    // (src/review/fixIt.ts lists the UCI first and does print it at a learner. Same
    // bug, different feature's file; noted rather than changed here.)
    answer: { moves: [c.bestSan] },
    // F-TS-3's "the coach's feedback names the game". This is the text the player
    // shows when the answer is revealed or got right.
    reason: `This is from ${c.provenance}. You played ${c.playedSan}; ${c.bestSan} was the move.`,
  };
}

/** The concepts an authored lesson teaches, in the order it teaches them. */
export function conceptsOf(lesson: Lesson): string[] {
  const seen = new Set<string>();
  for (const c of lesson.challenges) seen.add(c.concept);
  return [...seen];
}

export interface BuildInput {
  authored: Lesson;
  /** The unit's held-out bank, or null when the unit has none / it failed to load. */
  bank: CheckpointBank | null;
  /** Own candidates for the target theme, most recent first. */
  candidates: readonly OwnCandidate[];
  /** The engine gate. Injected so this is testable without Stockfish. */
  verify: (at: { fen: string; expectedUci: string }) => Promise<Verdict>;
  /** How many own positions to offer the engine. Bounded: each one is a search. */
  maxCandidates?: number;
}

/** How many own positions are worth a depth-14 search before a session starts. */
export const MAX_CANDIDATES = 12;

export async function buildTailoredLesson(input: BuildInput): Promise<TailoredLesson> {
  const size = input.authored.challenges.length;
  const concepts = conceptsOf(input.authored);
  const concept = concepts[0] ?? 'unclassified';

  const offered = input.candidates.slice(0, input.maxCandidates ?? MAX_CANDIDATES);
  const verdicts: Verdict[] = [];
  const own: Challenge[] = [];
  const unverified: OwnCandidate[] = [];
  for (const c of offered) {
    // Sequentially, not in parallel: the engine serialises requests anyway
    // (EngineClient has one worker and one job in flight), and stopping as soon as
    // the lesson is full saves the searches nobody needed.
    if (own.length >= size) break;
    const v = await input.verify({ fen: c.fen, expectedUci: c.bestUci });
    verdicts.push(v);
    if (v.verified) own.push(ownChallenge(c, concept));
    else unverified.push(c);
  }

  const usedIds = new Set(own.map((c) => c.id));
  const bank = (input.bank?.bank ?? []).filter((c) => concepts.includes(c.concept) && !usedIds.has(c.id));
  const fromBank = bank.slice(0, Math.max(0, size - own.length));
  for (const c of fromBank) usedIds.add(c.id);
  const fromAuthored = input.authored.challenges
    .filter((c) => !usedIds.has(c.id))
    .slice(0, Math.max(0, size - own.length - fromBank.length));

  return {
    lesson: {
      ...input.authored,
      id: `${TAILORED_ID_PREFIX}${input.authored.id}`,
      challenges: [...own, ...fromBank, ...fromAuthored],
    },
    authoredId: input.authored.id,
    own: own.length,
    fromBank: fromBank.length,
    fromAuthored: fromAuthored.length,
    rate: passRate(verdicts),
    unverified,
  };
}
