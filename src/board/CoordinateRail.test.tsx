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
  // On the squares, no ink is at full strength -- which is the whole reason
  // A3's per-square pick existed and why the glyphs had to move. In the gutter
  // the ink is --content on --surface and nothing can sit behind it.
  //
  // NEUMORPHIC-DELTA.md re-grounds --surface to #E0E5EC and --content to
  // #0F172B, which takes this pair from 13.53:1 to 14.08:1, and removes the
  // dark appearance. That removal is what moves the SECOND claim below: the
  // worst on-square combination used to be --content on --board-light in the
  // DARK appearance at 3.34:1, and with dark gone the worst is --content on
  // --board-dark at 5.06:1. The gutter's absolute advantage therefore IMPROVES
  // while its multiple over the worst square NARROWS, from 4.05x to 2.78x.
  // The old ">3x" threshold measured an appearance that no longer exists, so
  // it is re-derived rather than kept or quietly dropped, and the claim it
  // stands for -- the gutter beats every on-square combination by a wide
  // margin, with no marginal case anywhere -- is asserted against both halves.
  const p = FALLBACK_PALETTE;
  const WORST_ON_SQUARE = round(contrastRatio(p['--content'], p['--board-dark']));
  expect(WORST_ON_SQUARE).toBe(5.06);
  const ratio = round(contrastRatio(p['--content'], p['--surface']));
  expect(ratio).toBe(14.08);
  expect(ratio).toBeGreaterThanOrEqual(4.5);
  expect(ratio / WORST_ON_SQUARE).toBeGreaterThan(2.5);
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
