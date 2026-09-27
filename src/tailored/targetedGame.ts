import type { Color } from '@/rules';
import type { Phase, Review } from '@/review/types';
import type { OwnGame } from './ownPositions';
import { gameReference } from './ownPositions';

/**
 * F-TS-5, "The targeted game", verbatim:
 *
 * > "A bot game or mini-game chosen to provoke the weakness. For an opening weakness
 * > the opponent plays the line the learner struggles with, as the other colour. For a
 * > tactical weakness the game starts from one of the learner's own positions a few
 * > moves before the pattern arose, or the teaching-mode opponent (first update)
 * > steers toward it. For an endgame weakness the game is a set-position drill of that
 * > ending. Coach mode is on and prompts the relevant thinking-process question at the
 * > key moment."
 *
 * ── WHAT IS BUILT, AND WHAT IS NOT ───────────────────────────────────────────
 *
 *  - **Opening weakness** → built. The line the learner met is replayed by the bot,
 *    and the learner takes the other colour.
 *  - **Tactical weakness** → built. The game starts a few moves before the mistake.
 *  - **"or the teaching-mode opponent (first update)"** → NOT built, and the PRD
 *    itself marks it post-v1. There is no teaching-mode opponent in src/bot/.
 *  - **Endgame weakness** → NOT built, and reported as such rather than faked. It
 *    needs a set of authored endgame drill positions keyed to the ending in question;
 *    nothing in content/ carries them, and the honest output for an endgame weakness
 *    today is the own-position branch, which this returns with the reason stated.
 *  - **"prompts the relevant thinking-process question at the key moment"** → NOT
 *    built. Coach mode is switched on (that part is a URL parameter), but the coach is
 *    a one-way line: `CoachService` renders text, `CoachBubble` has no input, and no
 *    template in content/coach/templates.json is a question that awaits an answer.
 *    A question the learner cannot answer would be a prompt pretending to be a gate.
 *
 * Each of those is a sentence in the report rather than a stub in the code.
 */

/** How many plies before the mistake a targeted game begins. Three moves each. */
export const PLIES_EARLIER = 6;

/** How many plies of a game count as the opening line to hand the bot. */
export const LINE_PLIES = 8;

export type TargetedGame =
  | {
      kind: 'own-position';
      fen: string;
      learner: Color;
      /** Whole moves before the mistake this position is. */
      movesEarlier: number;
      provenance: string;
      reason: string;
      to: string;
    }
  | {
      kind: 'opening-line';
      /** UCI moves for the bot's opening book. */
      line: string[];
      learner: Color;
      openingName: string | null;
      provenance: string;
      reason: string;
      to: string;
    }
  | { kind: 'none'; reason: string };

function other(c: Color): Color {
  return c === 'w' ? 'b' : 'w';
}

/** The route a targeted game opens. Coach mode on, per F-TS-5. */
export function playUrl(o: { learner: Color; fen?: string; line?: readonly string[] }): string {
  const p = new URLSearchParams({ color: o.learner, tc: 'untimed', coach: '1' });
  if (o.fen !== undefined) p.set('fen', o.fen);
  if (o.line !== undefined && o.line.length > 0) p.set('line', o.line.join(' '));
  return `/play/game?${p.toString()}`;
}

/** Which phase a weakness happens in, by where its occurrences actually fell. */
export function phaseOf(games: readonly OwnGame[], theme: string): Phase | null {
  const counts: Record<Phase, number> = { opening: 0, middlegame: 0, endgame: 0 };
  let total = 0;
  for (const g of games) {
    for (const e of g.review.errors) {
      if (e.theme !== theme) continue;
      counts[e.phase] += 1;
      total += 1;
    }
  }
  if (total === 0) return null;
  // The phase a majority of them fall in. A plurality is not enough: a weakness
  // spread across the game is not an opening weakness, and building an opening line
  // for it would drill something the learner is not getting wrong there.
  for (const phase of ['opening', 'middlegame', 'endgame'] as const) {
    if (counts[phase] * 2 > total) return phase;
  }
  return 'middlegame';
}

/** `n` plies before `ply`, as a position, or null when the game did not go that far back. */
export function positionBefore(review: Review, ply: number, plies: number): { fen: string; ply: number } | null {
  const target = ply - plies;
  // No separate check for a negative target: `moves` is keyed by ply and holds no
  // negative one, so the lookup below already answers null for it. A mutation run
  // showed an explicit guard could be deleted without any test noticing, which means
  // it was not doing anything the lookup was not.
  const move = review.moves.find((m) => m.ply === target);
  if (!move) return null;
  // `fenBefore` of the move at that ply, so the learner plays from a position rather
  // than watching it be reached.
  return { fen: move.fenBefore, ply: target };
}

export interface TargetedInput {
  /** The learner's games with this theme, most recent first. */
  games: readonly OwnGame[];
  theme: string;
  now: Date;
  pliesEarlier?: number;
}

/**
 * The targeted game for a weakness, or an honest `none`.
 *
 * The most recent game carrying the theme is used, because that is the one the
 * learner remembers and the one the profile weighted most heavily.
 */
export function targetedGame(input: TargetedInput): TargetedGame {
  const game = input.games.find((g) => g.review.errors.some((e) => e.theme === input.theme));
  if (!game) {
    return { kind: 'none', reason: 'No game of yours shows this yet, so there is nothing to set up.' };
  }
  const error = game.review.errors.find((e) => e.theme === input.theme);
  if (!error) return { kind: 'none', reason: 'No game of yours shows this yet, so there is nothing to set up.' };
  const phase = phaseOf(input.games, input.theme);
  const provenance = gameReference(game, input.now);

  if (phase === 'opening') {
    // "The opponent plays the line the learner struggles with, as the other colour."
    // Read as: the line is replayed, and the learner sees it from the other side, so
    // the same position arrives with their roles swapped.
    const line = game.review.moves
      .filter((m) => m.ply < LINE_PLIES)
      .sort((a, b) => a.ply - b.ply)
      .map((m) => m.uci);
    if (line.length > 0) {
      const learner = other(game.review.learner);
      return {
        kind: 'opening-line',
        line,
        learner,
        openingName: game.review.opening?.name ?? null,
        provenance,
        reason: `The opening from ${provenance}, played back at you from the other side.`,
        to: playUrl({ learner, line }),
      };
    }
  }

  const plies = input.pliesEarlier ?? PLIES_EARLIER;
  // Walk back until a position exists: a mistake on move two has nothing six plies
  // before it, and the game should still be offered from as early as it goes.
  for (let back = plies; back >= 2; back -= 2) {
    const at = positionBefore(game.review, error.ply, back);
    if (!at) continue;
    const learner = game.review.learner;
    const movesEarlier = back / 2;
    const endgameNote =
      phase === 'endgame'
        ? ' There is no set-position endgame drill yet, so this starts from your own game instead.'
        : '';
    return {
      kind: 'own-position',
      fen: at.fen,
      learner,
      movesEarlier,
      provenance,
      reason: `From ${provenance}, ${String(movesEarlier)} ${movesEarlier === 1 ? 'move' : 'moves'} before it went wrong.${endgameNote}`,
      to: playUrl({ learner, fen: at.fen }),
    };
  }

  return {
    kind: 'none',
    reason: 'The mistake happened too early in the game to set a position up before it.',
  };
}
