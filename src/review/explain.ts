import { CoachService } from '@/coach';
import type { CoachEvent } from '@/coach';
import type { ReviewedMove } from './types';
import type { Theme } from './errorLog';

/**
 * PRD F-RV-5 and F-CO-4.
 *
 * The only sentences this can produce are the ones in
 * content/coach/templates.json, filled from facts supplied by the caller. When
 * a fact is missing, CoachService throws and this returns null: the key moment
 * then renders WITHOUT an explanation rather than with a plausible one. That is
 * the whole design — an explanation the engine did not verify is worse than
 * silence, because the learner cannot tell the difference.
 *
 * The placeholder contract is only half of F-CO-4. The other half is that a
 * template's prose may assert nothing beyond what its placeholders carry, which
 * no mechanism can check, so it is recorded here, per event, and the audit is
 * what the review stage checks:
 *
 * - reviewHungPiece   {pieceName}{square}: tagger `hangingPieces` says that
 *   piece is attacked and under-defended after the played move. {bestSan} is
 *   named only as the engine's move — NOT as a move that saves the piece, which
 *   nothing verifies.
 * - reviewMissedCapture {pieceName}{square}: tagger `winningCaptures` says the
 *   best move captures that piece on that square for material. "takes it" and
 *   "wins" are therefore licensed; the tagger is pessimistic, so it cannot
 *   over-claim.
 * - reviewMissedMate: tagger `mateInOne` says a mate existed and the played
 *   move was not it. {bestSan} is again only the engine's move — the templates
 *   never say bestSan IS the mate, because the tagger and the engine are two
 *   sources and only the tagger verified the mate.
 * - reviewIgnoredThreat: `threatsAgainst` says a winning capture stood before
 *   the move and still stood after it. Nothing verifies that {bestSan} answers
 *   the threat, so no template says it does.
 * - reviewUnclassified: the engine's own numbers say the played move lost
 *   expected score against {bestSan}. "stronger"/"prefers" is exactly that.
 * - reviewGoodMove: fires for Best, Excellent, Great and Brilliant. Only `Best`
 *   means "the engine's first choice", so the templates say "a strong move",
 *   never "the best move".
 * - reviewLessonLink {lessonTitle}: an authored curriculum mapping, not an
 *   engine fact; it claims only that the lesson covers the idea.
 * - reviewAsk: the played move and the existence of something better, both from
 *   the engine's numbers. It never names the better move — that is the reveal.
 *
 * A muted coach still explains. `muted` is the in-game chatter setting; a
 * learner who turned that off did not ask for a wordless review.
 */

export interface ExplainInput {
  move: ReviewedMove;
  theme: Theme;
  /** The title of the lesson that teaches the idea, or null. */
  lessonTitle: string | null;
  /** Only when the theme is hung_piece: the piece and where it stands. */
  hung?: { pieceName: string; square: string };
  /** Only when the theme is missed_capture: what was free and where. */
  free?: { pieceName: string; square: string };
}

export const THEME_EVENT: Record<Theme, CoachEvent> = {
  hung_piece: 'reviewHungPiece',
  missed_capture: 'reviewMissedCapture',
  missed_mate: 'reviewMissedMate',
  ignored_threat: 'reviewIgnoredThreat',
  unclassified: 'reviewUnclassified',
};

/** The complete set of facts this module ever supplies to a template. */
export const SUPPLIED_FACTS = ['playedSan', 'bestSan', 'pieceName', 'square', 'lessonTitle'] as const;

/** The review's own templates, all of them. Nothing else in the bank is ours. */
export const REVIEW_EVENTS = [
  ...Object.values(THEME_EVENT),
  'reviewGoodMove',
  'reviewLessonLink',
  'reviewAsk',
] as const satisfies readonly CoachEvent[];

/** Runs `fn` with the coach unmuted, and restores the setting whatever happens. */
function unmuted<T>(coach: CoachService, fn: () => T | null): T | null {
  const wasMuted = coach.muted;
  coach.muted = false;
  try {
    return fn();
  } catch {
    // CoachService threw because a template needed a fact nobody verified.
    // F-CO-4: say nothing rather than something.
    return null;
  } finally {
    coach.muted = wasMuted;
  }
}

export function explainMoment(coach: CoachService, input: ExplainInput): string | null {
  return unmuted(coach, () => {
    const facts: Record<string, string | number | undefined> = {
      playedSan: input.move.san,
      bestSan: input.move.best.san,
      pieceName: input.hung?.pieceName ?? input.free?.pieceName,
      square: input.hung?.square ?? input.free?.square,
    };

    const good =
      input.move.label === 'Best' ||
      input.move.label === 'Excellent' ||
      input.move.label === 'Great' ||
      input.move.label === 'Brilliant';
    const event: CoachEvent = good ? 'reviewGoodMove' : THEME_EVENT[input.theme];

    const body = coach.line(event, facts);
    if (body === null) return null;

    if (input.lessonTitle === null) return body;
    const link = coach.line('reviewLessonLink', { lessonTitle: input.lessonTitle });
    return link === null ? body : `${body} ${link}`;
  });
}

/** PRD F-RV-4: the question asked before the answer is revealed. */
export function askForBetter(coach: CoachService, move: ReviewedMove): string | null {
  return unmuted(coach, () => coach.line('reviewAsk', { playedSan: move.san }));
}
