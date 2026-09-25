import type { ReactNode } from 'react';
import { RAIL_REM } from '@/board/rail';

/**
 * A remark beside the thing it is about: a habit to keep, a reason an answer
 * is the answer.
 *
 * WHAT THIS REPLACES. Three screens rendered notable prose as
 * `border-l-2 border-accent bg-surface-raised` -- a 2px coloured stripe down
 * the left of a tinted box. That treatment arrived for a good reason
 * (PREMIUM-DELTA §5: `--accent-soft` meant five different things, and the chip
 * was the worst of them) and it landed on a pattern that is a tell in its own
 * right. A coloured side-stripe is decoration standing in for hierarchy: it
 * says "this bit is important" without saying what KIND of important, which is
 * why it ends up on everything.
 *
 * And it had: the lesson's habit, the puzzle's explanation and a "no puzzles
 * found" empty state all wore it. Those are three different speech acts. The
 * stripe was doing what `--accent-soft` had been doing, one layer along.
 *
 * So the fix is not a nicer box. It is to give the two that ARE asides the
 * grammar this app already reasoned its way to for asides, and to take the
 * empty state out of the set entirely -- an absence is not a remark, and
 * decorating it makes a normal result look like a fault.
 *
 * THE GRAMMAR, which `CoachBubble` established and `Annotation` followed: a
 * mark in the index column at `RAIL_REM`, prose hanging off it, the whole
 * thing pulled into the page gutter so the mark lands where the board's rank
 * glyphs and the path's unit numbers land (DESIGN-SYSTEM.md §4). No card, no
 * tint, no rule. Body text on the page ground is what a printed aside looks
 * like, and a padded surface turns a thing you read into a thing the app sent
 * you.
 *
 * Each aside carries its own mark, so the three are told apart by what they
 * are rather than by how loud they are:
 *
 *     ◇  the coach, speaking          (CoachBubble)
 *     ▪  the game, annotated          (Annotation)
 *     ·  a rule, or a reason          (here)
 *
 * The lead-in carries the emphasis the stripe was reaching for, in weight
 * rather than colour -- which also survives being read aloud, where a border
 * is silent.
 *
 * Contrast on `--surface` #E0E5EC, re-derived rather than inherited: prose and
 * the lead-in in `--content` #0F172B are 14.08:1; the mark in `--content-dim`
 * #475569 is 5.99:1. Both clear 4.5:1 as text and 3:1 as a glyph, and the mark
 * is decorative in any case -- it is `aria-hidden`, and the lead-in says in
 * words what kind of remark this is.
 */
export function Aside({
  /** The word that says what kind of remark this is: "Habit", "Why". */
  label,
  children,
  /** Screen-reader name. Defaults to the label, which is usually right. */
  ariaLabel,
}: {
  label?: string;
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <div
      className="mt-4 flex"
      // The same negative pull the coach's line and the game's annotation take,
      // so the mark sits in the index column at x=0 and the prose starts flush
      // with the content's left edge rather than 16px inside it.
      style={{ marginLeft: `-${String(RAIL_REM)}rem` }}
      role="note"
      aria-label={ariaLabel ?? label ?? 'Note'}
    >
      <span
        aria-hidden="true"
        data-aside-mark
        className="shrink-0 select-none text-center font-index text-[0.9375rem] leading-[1.625rem] text-content-dim"
        style={{ width: `${String(RAIL_REM)}rem` }}
      >
        ·
      </span>
      <p className="min-w-0 text-[1.0625rem] leading-[1.625rem] text-content">
        {label !== undefined && (
          <strong data-aside-label className="font-semibold">
            {label}
            {'  '}
          </strong>
        )}
        {children}
      </p>
    </div>
  );
}
