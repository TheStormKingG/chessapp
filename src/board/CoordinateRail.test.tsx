import { render } from '@testing-library/react';
import { CoordinateRail, RailIndex } from './CoordinateRail';
import { RAIL_REM, RAIL_TYPE, railFiles, railRanks } from './rail';
import { FALLBACK_PALETTE, contrastRatio } from './boardColors';

const round = (n: number) => Math.round(n * 100) / 100;

test('the rail reads as the player sees the board', () => {
  expect(railRanks('w')).toEqual(['8', '7', '6', '5', '4', '3', '2', '1']);
  expect(railFiles('w')).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  // Flipped, the near rank is 1 and the near-left file is h -- the rail has to
  // follow the board, or it names the wrong square.
  expect(railRanks('b')).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
  expect(railFiles('b')).toEqual(['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a']);
});

test('the rail is one mono, tabular, non-light index voice', () => {
  // DESIGN-SYSTEM.md 3.2, `index-small`: 12px, weight 600, +0.04em, tabular.
  // 12px clears the 11pt floor in typography.md > Ensuring legibility, and 600
  // answers the same page's warning against light weights at small sizes.
  expect(RAIL_TYPE).toContain('font-index');
  expect(RAIL_TYPE).toContain('text-[0.75rem]');
  expect(RAIL_TYPE).toContain('font-semibold');
  expect(RAIL_TYPE).toContain('tabular-nums');
});

test('the rail costs the board no width: it is exactly the compact gutter', () => {
  // The board surfaces are all inset by `p-4` (1rem). The rail is that same
  // 1rem, pulled back into the inset by Board.tsx's negative margin, so a
  // 390px phone renders the same board it did before the rail existed.
  expect(RAIL_REM).toBe(1);
});

test('the rail is the structural answer to C-2: full contrast on the page ground', () => {
  // On the squares, no single ink clears 4.5:1 on all four
  // square-and-appearance combinations -- which is the whole reason A3's
  // per-square pick existed and why the glyphs had to move. In the gutter the
  // ink is --content on --surface and nothing can sit behind it.
  for (const appearance of ['light', 'dark'] as const) {
    const p = FALLBACK_PALETTE[appearance];
    expect(round(contrastRatio(p['--content'], p['--surface'])), appearance).toBeGreaterThanOrEqual(15);
  }
});

test('the board rails are hidden from assistive technology', () => {
  // describeSquare already announces every coordinate through the board's one
  // live region. An exposed rail would say all sixteen of them a second time.
  const { container } = render(
    <>
      <CoordinateRail axis="rank" items={railRanks('w')} />
      <CoordinateRail axis="file" items={railFiles('w')} />
      <RailIndex>1.1.2</RailIndex>
    </>,
  );
  const rails = container.querySelectorAll('[data-rail]');
  expect(rails).toHaveLength(3);
  for (const r of rails) expect(r).toHaveAttribute('aria-hidden', 'true');
});

test('each board rail carries all eight indices', () => {
  const { container } = render(<CoordinateRail axis="rank" items={railRanks('w')} />);
  expect(container.querySelector('[data-rail="rank"]')?.textContent).toBe('87654321');
});
