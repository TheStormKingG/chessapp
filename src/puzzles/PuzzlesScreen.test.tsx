import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { PuzzlesScreen } from '@/screens/PuzzlesScreen';

function show(fixCount: number) {
  return render(
    <MemoryRouter>
      <PuzzlesScreen fixCount={fixCount} />
    </MemoryRouter>,
  );
}

/** The order on screen, read from the DOM rather than from the render call. */
function indexOf(pattern: RegExp): number {
  return screen.getAllByRole('link').findIndex((el) => pattern.test(el.textContent ?? ''));
}

test('the screen offers the three entry points (spec §5.1)', () => {
  show(0);
  expect(screen.getByRole('link', { name: /start solving/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /themed practice/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /daily puzzle/i })).toBeInTheDocument();
});

test('the apology is gone', () => {
  show(0);
  expect(screen.queryByText(/arrive in the next release/i)).not.toBeInTheDocument();
});

/**
 * F-PZ-3 makes the learner's own mistakes FIRST, so presence is not the claim —
 * position is. A test that only found the entry would pass with it rendered
 * last, which is the one arrangement F-PZ-3 rules out.
 */
test('fix my mistakes comes above the rated stream when there are mistakes', () => {
  show(4);
  const fixIdx = indexOf(/fix my mistakes/i);
  const ratedIdx = indexOf(/start solving/i);
  expect(fixIdx).toBeGreaterThanOrEqual(0);
  expect(ratedIdx).toBeGreaterThanOrEqual(0);
  expect(fixIdx).toBeLessThan(ratedIdx);
});

test('fix my mistakes is absent when the error log is empty', () => {
  show(0);
  expect(screen.queryByRole('link', { name: /fix my mistakes/i })).not.toBeInTheDocument();
});

test('the entry says how many mistakes are waiting, rather than implying one', () => {
  show(1);
  expect(screen.getByRole('link', { name: /fix my mistakes/i })).toHaveTextContent(/1 mistake\b/);
  show(4);
  expect(screen.getAllByRole('link', { name: /fix my mistakes/i })[1]).toHaveTextContent(/4 mistakes/);
});

test('the screen renders whole with no count supplied, as the route mounts it', () => {
  render(
    <MemoryRouter>
      <PuzzlesScreen />
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { name: 'Puzzles' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /start solving/i })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /fix my mistakes/i })).not.toBeInTheDocument();
});
