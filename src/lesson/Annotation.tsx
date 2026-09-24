import { applyMove } from '@/rules';
import { RAIL_REM } from '@/board/rail';

/**
 * The story-game annotation -- the paragraph a `guess_the_move` challenge owes
 * the learner once the move is settled.
 *
 * WHY THIS EXISTS AT ALL. `guess_the_move` has been a declared challenge type
 * since Phase 0: it is in `ChallengeType`, in both schemas, in `checkAnswer`,
 * in `revealText` and in the content verifier. Every one of those treats it as
 * a `find_the_move` that happens to carry one extra field, `commentary` --
 * and NOTHING rendered that field. A story game authored today would have been
 * a find-the-move with a different name and a silently dropped paragraph. The
 * type was not unbuilt; it was built wrong, in the way that is hardest to
 * notice, because every test it had still passed.
 *
 * So the gap this closes is one field, and the only real design question is
 * whose voice it is.
 *
 * NOT THE COACH. The obvious move is to put the commentary through
 * `CoachBubble` and be done. It is wrong twice. PRD F-PL-3 caps the coach at
 * one line per move and F-CO-1 makes them a persona who speaks rarely -- a
 * paragraph of game annotation is neither. And the two are different KINDS of
 * statement: the coach reacts to what the learner just did ("Yes -- that is
 * the one"), where the annotation says what the move meant in the game, which
 * is true whether the learner found it or revealed it. Chernev's voice in
 * `Logical Chess` is the model, and Chernev is not a tutor leaning over your
 * shoulder. Running both through one component would also mean the coach line
 * for this type IS the annotation, so a learner who got it wrong and retried
 * would lose their own feedback to the book's.
 *
 * Both appear, in that order: the coach's reaction, then the annotation.
 *
 * FORM. The same hanging structure as the coach's line -- a mark in the index
 * column at `RAIL_REM`, prose hanging off it, both pulled into the page gutter
 * so the mark sits where the board's rank glyphs and the path's unit numbers
 * sit (DESIGN-SYSTEM.md §4). The mark is `▪` against the coach's `◇`: solid
 * against hollow, which reads as printed against spoken. That is the whole of
 * the distinction, and it is deliberate that it is small -- these are the same
 * kind of thing (an aside about the position) in two voices, not two different
 * components that happen to be near each other.
 *
 * The MOVE leads the prose in bold, inline, the way a book prints it before
 * its paragraph. It does not go in the index column: `RAIL_REM` is 16px, sized
 * for one rank glyph, and `Bxh7+` is about 40px. A label that overflows its
 * column would break the one alignment this form exists to keep.
 *
 * It takes no panel, no card and no soft raise, for the reason CoachBubble
 * records at length: body text on the page ground is what a printed aside
 * looks like, and a padded surface would turn a paragraph you read into a
 * notification the app sent you.
 *
 * WHEN. Only once the challenge is settled (`correct` or `revealed`). An
 * annotation that appeared while the learner was still choosing would give the
 * move away, which is the whole of the exercise.
 *
 * ACCESSIBILITY. `role="note"` with a label naming it as the game's note, the
 * same contract CoachBubble uses and for the same reason: it tells a screen
 * reader this is commentary about the task rather than part of it. It is NOT a
 * live region -- it enters at the same instant as the coach's line, and two
 * polite regions firing together queue up and read one after the other, which
 * buries the feedback the learner actually asked for behind a paragraph. The
 * header counter is this screen's one announcement, and the annotation is
 * reachable by the reading cursor like the prompt above it.
 *
 * Contrast on `--surface` #E0E5EC, re-derived rather than inherited: the prose
 * and the bold move in `--content` #0F172B are 14.08:1, and the `▪` in
 * `--content-dim` #475569 is 5.99:1 -- which clears 4.5:1 as text and 3:1 as a
 * glyph. Nothing here is carried by colour: the mark is decorative and the
 * label is read.
 */
export function Annotation({
  fen,
  move,
  text,
}: {
  /** The position the move was played from -- the challenge's own `fen`. */
  fen: string;
  /** The answer, SAN or UCI; rendered as SAN, or as given when it will not parse. */
  move: string | undefined;
  text: string;
}) {
  if (!text.trim()) return null;
  // A move that will not parse still gets its paragraph. The content verifier
  // rejects an illegal one before it can ship, so reaching this fallback means
  // something upstream is already wrong -- and dropping the annotation on the
  // floor would hide that rather than report it.
  const label = move === undefined ? null : (sanOrNull(fen, move) ?? move);
  return (
    <div
      className="mt-6 flex"
      // The same negative pull the coach's line takes, so the mark lands in the
      // index column at x=0 and the prose starts flush with the board's left
      // edge rather than 16px inside it.
      style={{ marginLeft: `-${String(RAIL_REM)}rem` }}
      role="note"
      aria-label="From the game"
    >
      <span
        aria-hidden="true"
        data-annotation-mark
        className="shrink-0 select-none text-center font-index text-[0.9375rem] leading-[1.625rem] text-content-dim"
        style={{ width: `${String(RAIL_REM)}rem` }}
      >
        ▪
      </span>
      <p className="min-w-0 text-[1.0625rem] leading-[1.625rem] text-content">
        {label !== null && (
          <strong data-annotation-move className="font-semibold">
            {label}
            {'  '}
          </strong>
        )}
        {text}
      </p>
    </div>
  );
}

function sanOrNull(fen: string, move: string): string | null {
  try {
    return applyMove(fen, move).san;
  } catch {
    return null;
  }
}
