/**
 * C2 -- the vector symbol that replaces the `🏁` emoji on the checkpoint node.
 *
 * The hard constraint (DESIGN-SYSTEM.md §7, rule 8) is "no emoji as icons": an
 * emoji is a font-dependent colour glyph that renders differently on every
 * platform, ignores the ink around it, and is announced by its Unicode name.
 * `icons.md > Best practices` asks for the replacement: "If you create a custom
 * interface icon, use a vector format", drawn to "a consistent size, level of
 * detail, stroke thickness (or weight), and perspective".
 *
 * ## It joins the tab bar's family rather than starting a second one
 *
 * The document says a vector symbol "from the same family the tab bar uses", so
 * this glyph takes every drawing rule from `src/app/TabIcon.tsx` rather than
 * restating one of its own:
 *
 *   - 24-unit `viewBox`, rendered at 20px beside `heading` text (the tab bar's
 *     22px sits beside a 12px label; the same optical relationship).
 *   - `stroke-width: 1.6`, `stroke-linejoin: miter`, closed subpaths and no
 *     line caps -- the family is built from closed shapes, not open strokes.
 *     `icons.md > Best practices`: "match the weights of interface icons and
 *     adjacent text".
 *   - `fill-rule: evenodd`, so one path gives both the stroked and the filled
 *     state without internal detail vanishing into the fill. Filled is the
 *     resolved state, exactly as the tab bar fills the current tab.
 *   - `currentColor` for both stroke and fill: the symbol takes the ink of the
 *     row it sits on, so it inherits that row's measured contrast in both
 *     appearances instead of inventing a colour.
 *   - `aria-hidden`, because the node's `aria-label` already names the
 *     checkpoint. `icons.md` requires an alternative text label; that is it,
 *     and a second one would say "checkpoint" twice.
 */

/** A pennant on a pole: the checkpoint that gates a unit. */
export function CheckpointFlag({ filled = false, className }: { filled?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      fillRule="evenodd"
      clipRule="evenodd"
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.6}
      strokeLinejoin="miter"
    >
      <path d="M4.6 3h1.8v18H4.6V3Z M8 4h10l-2.9 4L18 12H8V4Z" />
    </svg>
  );
}
