/**
 * Button prominence, named once (chunk C4, DESIGN-SYSTEM.md §7 and M-2).
 *
 * Three levels and one role:
 *
 * - `primary`   filled accent. **One per screen.** `buttons.md > Style`: "use a
 *               button that has a prominent visual style for the most likely
 *               action in a view... Keep the number of prominent buttons to one
 *               or two per view."
 * - `secondary` bordered in `--edge-strong`. Same box metrics as `primary`, so
 *               a set of options reads as a coherent set and only the preferred
 *               member is filled — "Use style — not size."
 * - `quiet`     text only. For an action that is available but not being
 *               offered: a dismissal, an unbuilt feature, a footnote control.
 * - `danger`    the destructive *role*, at `quiet`'s weight so it can never
 *               outrank the screen's primary. `dangerQuiet` is the same role
 *               where the control already sits inside a bordered card and a
 *               second border would just be noise.
 *
 * Depth (PREMIUM-DELTA.md Δ1) is spelled in `theme.css`, not here. `primary`
 * carries a 3px solid `--key-accent` bottom edge and `secondary` a 2px
 * `--key-raised` one; `quiet`, `danger` and `dangerQuiet` carry none, because
 * a control that is not being offered is not a raised thing. Both references
 * express depth with a hard edge and no blur — chess.com's raised CTA tops out
 * at a 4px blur and Duolingo's key is `box-shadow: none` plus a 4px bottom
 * border — so a blur radius above 4px is banned app-wide, and at most one
 * element per screen (the primary) carries `--key-accent`.
 *
 * Exported as class strings rather than only as a component because half the
 * call sites are `<Link>`s and anchor elements whose semantics are already
 * correct; wrapping them to gain a style would change the DOM that the specs
 * assert on, and this chunk is a presentation change.
 */
export const btn = {
  primary: 'btn btn-primary',
  secondary: 'btn btn-secondary',
  quiet: 'btn btn-quiet',
  danger: 'btn btn-danger',
  dangerQuiet: 'btn btn-danger-quiet',
} as const;

export type Prominence = keyof typeof btn;
