// Imported from the rail's own module rather than the `@/board` barrel: the
// coach line renders on screens that have no board, and the barrel pulls in
// react-chessboard.
import { RAIL_REM } from '@/board/rail';
import { coachName } from './CoachService';

/**
 * C5 -- the coach's voice on screen. DESIGN-SYSTEM.md §3.3 is the authority:
 *
 *     ◇ The knight on c7 attacks two
 *       things at once.
 *
 * What changed and why. The previous treatment was a bordered, tinted card with
 * a filled circle standing in for an avatar: the visual grammar of a
 * notification, and a notification is a thing the app sends you, not a person
 * talking to you. PRD F-CO-1/F-CO-2 make the coach ONE persona, warm and dry
 * and never academic, and PRD F-PL-3 caps them at one line per move -- a voice
 * that speaks rarely and quietly. So the box is gone. The line sits on the page
 * ground in body type, at the same measure as everything else on the screen,
 * which is what a spoken remark looks like in print.
 *
 * Three decisions carry it:
 *
 *   - `◇` in the rail column. `RAIL_REM` wide, `--font-index`, at exactly the
 *     x-position the board's rank glyphs and the path's unit numbers occupy
 *     (DESIGN-SYSTEM.md §4). The coach's mark lands in the app's one index
 *     column, so the voice is indexed like every other thing on the screen
 *     rather than floated beside it. The text hangs off it -- a second line
 *     wraps to the text edge, not back under the mark -- which is the
 *     typographic form of an aside.
 *   - `body` type, 17px/26px (§3.2), NOT the 14px the card used. The coach is
 *     prose to be read, not metadata to be scanned; `typography.md >
 *     Specifications` puts the iOS body default at 17pt and this is the one
 *     place in a lesson where a whole sentence is read.
 *   - Tone is a second channel, never the only one. The mark takes `--accent`
 *     when the answer was right and `--signal` ("look again") when it was not,
 *     and `--content-dim` otherwise; the sentence itself always says which it
 *     is, so nothing here is carried by colour alone (F-AX-2). `--danger` is
 *     deliberately not used: §3.1 reserves it for destructive UI, and a wrong
 *     move in a lesson is the material, not a hazard.
 *
 *   - A GROUP-SIZED step above it, not a line-sized one. §3.3 sets the vertical
 *     rhythm by role -- "8 inside a control, 12 between related lines, 24
 *     between groups" -- and the §3.3 lesson diagram draws a blank line above
 *     the coach and another below it, so the line is its own group. It was
 *     16px, which is neither value, and measured in the browser at 390px it
 *     left the coach exactly 16px below the board and exactly 16px above the
 *     Hint row: equidistant, and so belonging to neither. At 24px above, the
 *     utterance is a thing that follows the position rather than a caption
 *     stuck to the controls under it. Nothing else about the line moves: the
 *     mark keeps the index column, the sentence keeps the board's left edge.
 *
 * NEUMORPHIC-DELTA.md chunk N2 lists this file among the containers that take
 * the soft raise. It takes NONE, and that is the considered answer rather than
 * an omission, so it is written down here where the next pass will read it.
 *
 * This component has no container. There is no card, no panel and no
 * `--surface-raised` anything: there is a mark in the index column and a
 * sentence on the page ground. `n-raised` has nothing to go on that would not
 * first have to be invented — and inventing it is precisely the change the
 * paragraphs above record undoing. A soft raise is the neumorphic spelling of
 * the same bordered, tinted box; it would put the coach back inside a thing the
 * app sends you instead of leaving them a person talking to you, and it would
 * cost the two signatures §6 of that delta says are this product's own and not
 * the style's: the `◇` sitting in the app's one index column at the board's
 * rank-glyph x-position, and the sentence starting flush with the board's own
 * left edge. Both die the moment a padded surface goes round them.
 *
 * The 24px step above it does the work a card would have done — it groups the
 * line with the position rather than with the buttons — and it costs no depth
 * at all. §3.2 of the delta is the licence for stopping here: the reference's
 * own treatment "stops", with body text, list rows and headings sitting
 * directly on the ground and no treatment at all. This is body text on the
 * ground. Where the delta and the screen disagree, the screen is the artefact.
 *
 * The re-grounded figures, re-derived rather than copied (observation 0113) —
 * the ones above are from the appearance that no longer exists. On `--surface`
 * #E0E5EC: the sentence in `--content` #0F172B is **14.08:1**; the mark is
 * **5.99:1** dim (#475569), **5.85:1** accent (#12614A) and **5.40:1** signal
 * (#7A5310). Every one clears 4.5:1 as text and 3:1 as a non-text glyph, and
 * the tone is never alone in saying which it is — the sentence says it too.
 *
 * `role="note"` with the coach's name is unchanged: it is what tells a screen
 * reader that this sentence is someone speaking rather than part of the task,
 * and it is the one thing about this component that assistive technology reads.
 */
export function CoachBubble({ text, tone = 'neutral' }: { text: string | null; tone?: 'neutral' | 'good' | 'bad' }) {
  if (!text) return null;
  const mark = tone === 'good' ? 'text-accent' : tone === 'bad' ? 'text-signal' : 'text-content-dim';
  return (
    <div
      className="mt-6 flex"
      // Pulled into the page gutter by exactly the rail's width, the same way
      // the board pulls its own rank column: the mark then sits in the index
      // column at x=0 and the sentence starts at the board's left edge, so the
      // coach's line and the position it is about are flush. Measured in the
      // browser: without this the mark sat at 16px and the rail at 0, which is
      // a signature claimed in prose and not kept on screen.
      style={{ marginLeft: `-${String(RAIL_REM)}rem` }}
      role="note"
      aria-label={`${coachName} says`}
    >
      <span
        aria-hidden="true"
        data-coach-mark
        className={`shrink-0 select-none text-center font-index text-[0.9375rem] leading-[1.625rem] ${mark}`}
        style={{ width: `${String(RAIL_REM)}rem` }}
      >
        ◇
      </span>
      <p className="min-w-0 text-[1.0625rem] leading-[1.625rem] text-content">{text}</p>
    </div>
  );
}
