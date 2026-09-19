import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Summary } from './Summary';
import type { Review } from './types';

function review(o: Partial<Review> = {}): Review {
  return {
    gameId: 'g1',
    learner: 'w',
    depth: 14,
    partial: false,
    moves: [],
    accuracy: { w: 72.5, b: 61.3 },
    counts: { Best: 10, Good: 5, Mistake: 3, Blunder: 2 },
    opening: { name: 'Italian Game', leftBookAtPly: 8 },
    turningPhase: 'middlegame',
    keyMoments: [
      { ply: 10, kind: 'decided', deeper: null, explanation: null, lessonId: null },
      { ply: 20, kind: 'missed', deeper: null, explanation: null, lessonId: null },
    ],
    errors: [],
    createdAt: '2026-09-19T00:00:00.000Z',
    ...o,
  };
}

test('accuracy is shown for both sides', () => {
  render(<Summary review={review()} onStart={() => {}} />);
  expect(screen.getByText(/72\.5/)).toBeVisible();
  expect(screen.getByText(/61\.3/)).toBeVisible();
});

test('a null accuracy renders an em dash, never a number', () => {
  render(<Summary review={review({ accuracy: { w: null, b: null } })} onStart={() => {}} />);
  expect(screen.queryByText(/100/)).not.toBeInTheDocument();
  expect(screen.getAllByText('—').length).toBeGreaterThan(0);
});

test('the opening name and the move it left book are both shown', () => {
  render(<Summary review={review()} onStart={() => {}} />);
  expect(screen.getByText(/Italian Game/)).toBeVisible();
  // Ply 8 is White's fifth move.
  expect(screen.getByText(/move 5/i)).toBeVisible();
});

test('a game that never left book says so rather than naming a move', () => {
  render(<Summary review={review({ opening: { name: 'Ruy Lopez', leftBookAtPly: null } })} onStart={() => {}} />);
  expect(screen.getByText(/never left/i)).toBeVisible();
});

test('a game with no opening name omits the line entirely', () => {
  render(<Summary review={review({ opening: null })} onStart={() => {}} />);
  expect(screen.queryByText(/left the book/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/never left/i)).not.toBeInTheDocument();
});

test('each label that occurred is listed with its count and its word', () => {
  render(<Summary review={review()} onStart={() => {}} />);
  expect(screen.getByText('Blunder')).toBeVisible();
  expect(screen.getByText('Mistake')).toBeVisible();
  // A label that did not occur is not listed as zero.
  expect(screen.queryByText('Brilliant')).not.toBeInTheDocument();
});

test('the depth the review actually ran at is stated', () => {
  render(<Summary review={review({ depth: 10 })} onStart={() => {}} />);
  expect(screen.getByText(/depth 10/i)).toBeVisible();
});

/**
 * Defect 3 of the spec-coverage audit. The banner said "Still analysing the
 * last few moves", and nothing is analysing anything: `partial` has exactly two
 * production readers — `reviewFor`, which throws the cached partial away and
 * re-runs from scratch on the next visit, and `bankReview`, which refuses. No
 * scheduler and no continuation exist anywhere in src/.
 *
 * The banner must say what is true and offer the real next step. Nothing
 * resumes the analysis, so it still may not promise background work.
 *
 * What changed since: `bankReview` now banks a partial review (product
 * decision, PRD 2.2 — the learner did the work and a slow device is not their
 * fault). So the banner must no longer read as though the review was for
 * nothing. It has to state BOTH facts: the analysis is incomplete, and the game
 * counted anyway.
 */
const PROMISES_BACKGROUND_WORK = /still analysing|analysing the last|in the background|will finish|finishing|when it completes|completing/i;

test('a partial review says so and cannot be started as if complete', () => {
  render(<Summary review={review({ partial: true })} onStart={() => {}} />);
  expect(screen.getByText(/not complete/i)).toBeVisible();
});

test('a partial review does not promise work that nothing is doing', () => {
  const { container } = render(<Summary review={review({ partial: true })} onStart={() => {}} />);
  expect(container.textContent ?? '').not.toMatch(PROMISES_BACKGROUND_WORK);
});

test('a partial review states how far it actually got', () => {
  const moves = Array.from({ length: 23 }, (_, ply) => ({ ply })) as Review['moves'];
  render(<Summary review={review({ partial: true, moves })} onStart={() => {}} />);
  expect(screen.getByText(/first 23 moves/i)).toBeVisible();
});

test('a partial review offers the step the code actually takes', () => {
  render(<Summary review={review({ partial: true })} onStart={() => {}} />);
  // `reviewFor` discards a cached partial and re-runs, so the honest offer is
  // that opening it again analyses the game from the start.
  expect(screen.getByText(/again/i)).toBeVisible();
});

test('a partial review says the game still counted, because it did', () => {
  render(<Summary review={review({ partial: true })} onStart={() => {}} />);
  expect(screen.getByText(/still counts/i)).toBeVisible();
});

test('a complete review does not need telling the learner it counted', () => {
  // The reassurance belongs to the partial case only — on a complete review it
  // would raise a doubt nobody had. This is the negative control for the test
  // above: without it, copy that always says "still counts" would pass.
  const { container } = render(<Summary review={review({ partial: false })} onStart={() => {}} />);
  expect(container.textContent ?? '').not.toMatch(/still counts/i);
});

test('the number of moments is stated rather than padded to three', () => {
  render(<Summary review={review()} onStart={() => {}} />);
  expect(screen.getByText(/2 moments/i)).toBeVisible();
});

test('one moment is described in the singular', () => {
  render(<Summary review={review({ keyMoments: [{ ply: 10, kind: 'decided', deeper: null, explanation: null, lessonId: null }] })} onStart={() => {}} />);
  expect(screen.getByText(/1 moment\b/i)).toBeVisible();
});

test('the primary action starts the first moment', async () => {
  const onStart = vi.fn();
  render(<Summary review={review()} onStart={onStart} />);
  await userEvent.click(screen.getByRole('button', { name: /first moment/i }));
  expect(onStart).toHaveBeenCalledOnce();
});

test('the label definitions are one tap away and name every label', async () => {
  render(<Summary review={review()} onStart={() => {}} />);
  await userEvent.click(screen.getByRole('button', { name: /what do these mean/i }));
  for (const l of ['Brilliant', 'Great', 'Best', 'Excellent', 'Good', 'Book', 'Inaccuracy', 'Mistake', 'Miss', 'Blunder']) {
    expect(screen.getAllByText(l).length).toBeGreaterThan(0);
  }
});

test('there is exactly one live region on this screen', () => {
  const { container } = render(<Summary review={review()} onStart={() => {}} />);
  expect(container.querySelectorAll('[aria-live]')).toHaveLength(1);
});
