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

test('a partial review says so and cannot be started as if complete', () => {
  render(<Summary review={review({ partial: true })} onStart={() => {}} />);
  expect(screen.getByText(/still analysing/i)).toBeVisible();
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
