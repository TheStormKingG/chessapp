/**
 * Button prominence, named once (chunk C4, DESIGN-SYSTEM.md §7 and M-2).
 *
 * Three levels and one role:
 *
 * - `primary`   filled accent. **One per screen.** `buttons.md > Style`: "use a
 *               button that has a prominent visual style for the most likely
 *               action in a view... Keep the number of prominent buttons to one
 *               or two per view."
 * - `secondary` bordered in `--edge-strong`, over the soft raise. Same box metrics as `primary`, so
 *               a set of options reads as a coherent set and only the preferred
 *               member is filled — "Use style — not size."
 * - `quiet`     text only. For an action that is available but not being
 *               offered: a dismissal, an unbuilt feature, a footnote control.
 * - `danger`    the destructive *role*, at `quiet`'s weight so it can never
 *               outrank the screen's primary. `dangerQuiet` is the same role
 *               where the control already sits inside a bordered card and a
 *               second border would just be noise.
 *
 * Depth is spelled in `theme.css`, not here, and it has been REVERSED since
 * this comment was first written. PREMIUM-DELTA.md Δ1 banned blur outright on
 * the evidence that chess.com and Duolingo both express depth with a hard
 * edge; NEUMORPHIC-DELTA.md §2 records the owner's override of that finding
 * and what it costs. Depth is now the reference's soft `--shadow-raised` pair
 * on `primary` and `secondary`, and `secondary`'s 2px `--key-raised` bottom
 * edge is gone — one depth grammar per element (§6). `primary` alone keeps a
 * 3px solid `--key-accent` bottom edge UNDER its raise, because a filled face
 * plus a blur is still not an edge.
 *
 * The blur ban survives as a token-identity guard rather than a numeric cap:
 * `tests/audit/audit-helpers.ts` allows a blurred shadow only when its
 * computed value is exactly one of the four sanctioned tokens.
 *
 * `quiet`, `danger` and `dangerQuiet` carry no raise, because a control that
 * is not being offered is not a raised thing. They are not unbounded either:
 * `danger` keeps its full-strength border and `quiet` and `dangerQuiet` keep
 * an underline, so a hue is never the only thing making them a control
 * (chunk N4; `tests/audit-platform/controls.spec.ts` measures all of it).
 *
 * Press and disabled are also depth rather than colour — raised, inset, flat —
 * and are defined once in `theme.css` for every `.btn` and `.icon-control`.
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
