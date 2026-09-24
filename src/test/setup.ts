import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

/*
 * jsdom reports "prefers reduced motion", and that is the honest setting.
 *
 * `react-chessboard` ANIMATES a piece between squares when the position
 * changes, and to do that it measures a square. jsdom has no layout, so the
 * measurement returns nothing and it throws "Square width not found" -- taking
 * down whatever test happened to change a board.
 *
 * It went unnoticed for as long as nothing ever changed a challenge board's
 * position. The moment one did -- showing the learner the move they had just
 * played -- five FixItDrill tests went red on an error that had nothing to do
 * with them.
 *
 * Reporting `reduce` turns the animation off, which is both the fix and the
 * truth: an environment with no layout and no compositor cannot animate, and
 * the app already treats that preference as "show the end state, skip the
 * movement". Motion itself is covered where it can actually be observed -- in
 * Playwright, against a rendered page.
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string): MediaQueryList =>
    ({
      matches: /prefers-reduced-motion/.test(query),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList,
});
