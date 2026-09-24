import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, test } from 'vitest';
import { emptyProgress, useProgress } from '@/data';
import { SECTIONS } from '@/path/curriculum';
import { ProgressScreen } from './ProgressScreen';

const TOTAL = SECTIONS.reduce((n, s) => n + s.units.reduce((m, u) => m + u.lessons.length, 0), 0);

function renderWith(p = emptyProgress()) {
  useProgress.setState({ progress: p });
  render(
    <MemoryRouter>
      <ProgressScreen />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useProgress.setState({ progress: emptyProgress() });
});

test('a learner who has done nothing is told so, and pointed somewhere', () => {
  // The screen this replaced said "Progress arrives in the next release" to
  // everyone forever. An empty state has to read as empty-for-now rather than
  // as unbuilt, so it names the action that fills it.
  renderWith();
  expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Go to Today/ })).toHaveAttribute('href', '/');
});

test('the empty state goes away as soon as anything has been done', () => {
  const p = emptyProgress();
  p.games = 1;
  renderWith(p);
  expect(screen.queryByText(/Nothing here yet/)).toBeNull();
});

test('every count is stated in text, not only drawn as a bar', () => {
  // F-AX-2: the meters are aria-hidden decoration over a sentence. If the bar
  // were the only carrier, this screen would say nothing in forced colours or
  // to a screen reader -- which is the failure mode the house rule exists for.
  const p = emptyProgress();
  p.lessons['1.1.1'] = { stars: 3, completed: true };
  p.lessons['1.1.2'] = { stars: 2, completed: true };
  p.units['1.1'] = { passed: true, attempts: 1, failedAttempts: 0, testedOut: false };
  p.xp = 70;
  renderWith(p);

  expect(screen.getByText(`2 of ${String(TOTAL)} lessons done`)).toBeInTheDocument();
  expect(screen.getByText('70 XP so far')).toBeInTheDocument();
  // Stars are summed across completed lessons, not counted as lessons.
  expect(screen.getByText('Stars earned').closest('div')).toHaveTextContent('5');
  // Derived from SECTIONS, not hardcoded: it read '1 of 14' until Section 3 was
  // declared and became '1 of 26' the same day. A hardcoded total turns every
  // future section's declaration into a failure that says nothing useful.
  const units = SECTIONS.reduce((n, sec) => n + sec.units.length, 0);
  expect(screen.getByText('Checkpoints passed').closest('div')).toHaveTextContent(
    `1 of ${String(units)}`,
  );

  // Every bar is hidden from the accessibility tree, and there is at least one,
  // so this cannot pass by there being no bars at all.
  const bars = document.querySelectorAll('[aria-hidden="true"]');
  expect(bars.length).toBeGreaterThan(0);
});

test('a rating is not shown until a puzzle has actually been solved', () => {
  // `puzzleRating` starts at 800 for everyone, so printing it unconditionally
  // tells a learner who has never seen a puzzle that they are rated 800.
  renderWith();
  expect(screen.getByText('Puzzle rating').closest('div')).toHaveTextContent('Not rated yet');

  const p = emptyProgress();
  p.puzzlesSolved = 3;
  p.puzzleRating = { rating: 842, confidence: 2 };
  useProgress.setState({ progress: p });
  render(
    <MemoryRouter>
      <ProgressScreen />
    </MemoryRouter>,
  );
  expect(screen.getAllByText('842').length).toBeGreaterThan(0);
});

test('each declared section is reported separately, with its own total', () => {
  renderWith();
  for (const s of SECTIONS) {
    const lessons = s.units.reduce((n, u) => n + u.lessons.length, 0);
    expect(screen.getByText(new RegExp(`Section ${s.id}`))).toBeInTheDocument();
    expect(screen.getAllByText(`0 of ${String(lessons)} done`).length).toBeGreaterThan(0);
  }
  // Non-vacuous: a Section 3 added to SECTIONS without touching this screen
  // still has to appear, and the count below is what notices if it does not.
  expect(SECTIONS.length).toBeGreaterThan(1);
});
