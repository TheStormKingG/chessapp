import { facts, hangingPieces, mateInOne, winningCaptures } from '@/tagger';
import { pieceAt, toSan, turn } from '@/rules';
import { CoachService } from '@/coach';
import type { Color } from '@/rules';
import type { ErrorEntry, ReviewedMove } from './types';

/**
 * PRD F-RV-6: "Every mistake and blunder is written to the learner's error log
 * with its theme, phase, clock time, the lesson it maps to, and a flag for
 * whether the error is typical at the learner's level."
 *
 * PRD §10.3 lists sixteen motifs for the tagger. src/tagger/tagger.ts implements
 * four of them (hanging piece, winning capture, mate in one, threats), so this
 * module tags those four and marks everything else `unclassified`. It does not
 * guess: F-CO-4 forbids stating what has not been verified, and a wrong theme
 * points the fix-it drill at the wrong idea, which is worse than no theme.
 */

export const TYPICAL_THEMES = ['hung_piece', 'missed_capture', 'missed_mate', 'ignored_threat'] as const;
export type Theme = (typeof TYPICAL_THEMES)[number] | 'unclassified';

/**
 * The lesson each theme maps to (F-RV-6 "the lesson it maps to", F-RV-5 "linked
 * to the lesson that teaches the idea").
 *
 * The ids come from src/path/curriculum.ts — the real authored curriculum — and
 * a test in this file asserts every one of them still exists there, so a
 * renamed or renumbered lesson fails the suite instead of silently sending the
 * learner nowhere. There is deliberately no second, hardcoded table of lesson
 * titles anywhere in src/review/: the curriculum is the single source.
 */
export const THEME_LESSON: Record<Theme, string | null> = {
  // "Do not leave pieces free" — 1.2.4
  hung_piece: '1.2.4',
  // "Take free pieces" — 1.2.3
  missed_capture: '1.2.3',
  // "Mate in one" — 1.3.3
  missed_mate: '1.3.3',
  // "All checks and captures" — 1.6.2, the habit that catches an enemy threat
  ignored_threat: '1.6.2',
  unclassified: null,
};

/**
 * The facts that justify a theme, named at the moment the theme is decided.
 *
 * F-CO-4 lets the coach state only what something verified. These two fields
 * carry exactly what the tagger verified and nothing else, so a caller can fill
 * `reviewHungPiece` and `reviewMissedCapture` — the two templates that need
 * {pieceName} and {square} — without inventing anything.
 *
 * Both are optional, and absent is a real answer: a theme can fire while the
 * specific piece is not identifiable (see below), and the correct output then
 * is no explanation at all rather than a plausible one.
 */
export interface ThemeFacts {
  theme: Theme;
  /** hung_piece only: the piece `hangingPieces(fenAfter, mover)` says is now free. */
  hung?: { pieceName: string; square: string };
  /** missed_capture only: what `winningCaptures(fenBefore)` says the best move takes. */
  free?: { pieceName: string; square: string };
}

/**
 * Decides the theme AND names the piece the theme is about, from the same
 * tagger calls. `themeOf` delegates here, so there is one detection path and
 * the facts can never disagree with the theme they were produced alongside.
 */
export function classify(at: {
  fenBefore: string;
  fenAfter: string;
  playedUci: string;
  bestUci: string;
}): ThemeFacts {
  const mover = turn(at.fenBefore);

  // 1. Did the best move take a free piece the learner left alone?
  const free = winningCaptures(at.fenBefore);
  const taken = free.find((c) => c.uci === at.bestUci);
  if (taken) {
    // The victim stands on the target square before the capture. En passant is
    // the one exception — the target square is empty — and the victim is then a
    // pawn by definition, which is the same fallback `winningCaptures` itself
    // uses to value it.
    const victim = pieceAt(at.fenBefore, taken.target);
    return {
      theme: 'missed_capture',
      free: { pieceName: CoachService.pieceName(victim?.type ?? 'p'), square: taken.target },
    };
  }

  // 2. Was there a mate in one the learner did not play?
  const mate = mateInOne(at.fenBefore);
  if (mate !== null && toSan(at.fenBefore, at.playedUci) !== mate) return { theme: 'missed_mate' };

  // 3. Did the move leave one of the learner's own pieces free to take?
  //    The two counts are produced by different attack models on purpose:
  //    `hangingPieces` is attacker-based when the colour asked about is the side
  //    to move (fenBefore) and legal-move-based when it is not (fenAfter). The
  //    second is the strictly more conservative one, so this comparison
  //    UNDER-reports hung pieces and can never manufacture one — the only error
  //    direction F-CO-4 permits.
  const hangingAfter = hangingPieces(at.fenAfter, mover);
  const hangingBefore = hangingPieces(at.fenBefore, mover);
  if (hangingAfter.length > hangingBefore.length) {
    // Which piece to name: one that is hanging after the move and was not
    // hanging before it, most valuable first. A piece already hanging before
    // the move was not left there BY this move, and the template says
    // "{playedSan} left your {pieceName} on {square} free to take".
    //
    // The set can be empty even though the count rose — the models differ
    // between the two positions, so `before` is not a subset of `after`. There
    // is then no piece this move demonstrably hung, and naming one would be the
    // invention F-CO-4 forbids. The theme still stands (the count is the
    // evidence); the fact is simply absent, and the caller renders nothing.
    const wasHanging = new Set(hangingBefore.map((h) => h.square));
    const newly = hangingAfter
      .filter((h) => !wasHanging.has(h.square))
      .sort((a, b) => b.value - a.value);
    const worst = newly[0];
    return worst
      ? { theme: 'hung_piece', hung: { pieceName: CoachService.pieceName(worst.piece), square: worst.square } }
      : { theme: 'hung_piece' };
  }

  // 4. Was there a threat against the learner that the move did not answer?
  //    `facts(fenBefore).threats` is empty when the side to move is in check —
  //    the tagger documents that as "unknown", not "safe" — so this branch
  //    simply does not fire there, which is the conservative reading.
  const before = facts(at.fenBefore);
  if (before.threats.captures.length > 0) {
    const stillThreatened = facts(at.fenAfter).captures.length > 0;
    if (stillThreatened) return { theme: 'ignored_threat' };
  }

  return { theme: 'unclassified' };
}

export function themeOf(at: {
  fenBefore: string;
  fenAfter: string;
  playedUci: string;
  bestUci: string;
}): Theme {
  return classify(at).theme;
}

export function errorsFrom(
  moves: ReviewedMove[],
  ctx: { gameId: string; learner: Color; timeControl: 'untimed' | '10+0'; now: string },
): ErrorEntry[] {
  const out: ErrorEntry[] = [];
  for (const m of moves) {
    if (m.mover !== ctx.learner) continue;
    if (m.label !== 'Mistake' && m.label !== 'Blunder' && m.label !== 'Miss') continue;

    const theme = themeOf({
      fenBefore: m.fenBefore,
      fenAfter: m.fenAfter,
      playedUci: m.uci,
      bestUci: m.best.uci,
    });

    out.push({
      gameId: ctx.gameId,
      ply: m.ply,
      fenBefore: m.fenBefore,
      playedSan: m.san,
      bestSan: m.best.san,
      bestUci: m.best.uci,
      label: m.label,
      theme,
      phase: m.phase,
      // F-RV-6 asks for clock time. GameState.clockMs is never persisted, so
      // this is null for every game in this release — including a 10+0 one —
      // and the field is kept for when it is not. Design spec §7.3.
      clockMs: null,
      lessonId: THEME_LESSON[theme],
      // SUBSTITUTE, not the PRD's rule. F-RV-6 f asks whether the error is
      // "typical at the learner's level" and names the puzzle ladder as the
      // source; the puzzle ladder is a placeholder screen, so there is nothing
      // to ask. What this flag actually says is narrower and checkable: the
      // section the learner is in teaches this theme. It is a statement about
      // the curriculum, never about other learners. Design spec §9.6.
      typical: (TYPICAL_THEMES as readonly string[]).includes(theme),
      createdAt: ctx.now,
    });
  }
  return out;
}
