import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FixItDrill } from './FixItDrill';
import { drillFrom } from './fixIt';
import type { ErrorEntry } from './types';

const errs: ErrorEntry[] = [10, 12, 14].map((ply) => ({
  gameId: 'g1',
  ply,
  fenBefore: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1',
  playedSan: 'Qh5',
  bestSan: 'Nf3',
  bestUci: 'g1f3',
  label: 'Blunder',
  theme: 'hung_piece',
  phase: 'opening',
  clockMs: null,
  lessonId: '1.3.1',
  typical: true,
  createdAt: '2026-09-19T00:00:00.000Z',
}));

const drill = () => drillFrom(errs)!;

/** Answers all three challenges in text-entry mode and lands on the close screen. */
async function playThrough() {
  await userEvent.click(screen.getByRole('button', { name: /start/i }));
  for (let i = 0; i < 3; i += 1) {
    await userEvent.type(screen.getByLabelText('Type a move'), 'Nf3{enter}');
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
  }
}

test('the drill renders through the shipped lesson player', () => {
  render(<FixItDrill drill={drill()} onBanked={() => {}} onDone={() => {}} onLesson={() => {}} textEntry />);
  // The player's own card screen is what appears first. "Fix it" itself is both
  // the player's title chrome and the card heading, so the card's own idea line
  // is what identifies the screen unambiguously.
  expect(screen.getAllByText(/Fix it/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/where something went wrong/i)).toBeVisible();
});

test('no XP is claimed, because the review event awards it', () => {
  render(<FixItDrill drill={drill()} onBanked={() => {}} onDone={() => {}} onLesson={() => {}} textEntry />);
  expect(screen.queryByText(/XP/i)).not.toBeInTheDocument();
});

test('the close screen says the review is done, not the lesson', async () => {
  render(<FixItDrill drill={drill()} onBanked={() => {}} onDone={() => {}} onLesson={() => {}} textEntry />);
  await playThrough();
  expect(screen.getByRole('heading', { name: /review done/i })).toBeVisible();
});

/**
 * F-RV-7c and design spec §8: the screen that says the review is done must not
 * be the first thing that makes it true. The banking call therefore rides on
 * the player's `onOutcome`, which fires when the close screen is REACHED.
 */
test('the review is banked by the time the close screen is on show', async () => {
  const order: string[] = [];
  render(
    <FixItDrill
      drill={drill()}
      onBanked={() => order.push('banked')}
      onDone={() => order.push('done')}
      onLesson={() => {}}
      textEntry
    />,
  );
  await playThrough();
  expect(screen.getByRole('heading', { name: /review done/i })).toBeVisible();
  expect(order).toEqual(['banked']);
});

test('dismissing the close screen is what leaves, and it leaves once', async () => {
  const onDone = vi.fn();
  render(<FixItDrill drill={drill()} onBanked={() => {}} onDone={onDone} onLesson={() => {}} textEntry />);
  await playThrough();
  expect(onDone).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: /back to the path/i }));
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('leaving early by the drill’s own exit still banks and still leaves', async () => {
  const order: string[] = [];
  render(
    <FixItDrill
      drill={drill()}
      onBanked={() => order.push('banked')}
      onDone={() => order.push('done')}
      onLesson={() => {}}
      textEntry
    />,
  );
  await playThrough();
  await userEvent.click(screen.getByRole('button', { name: /exit review/i }));
  expect(order).toEqual(['banked', 'done']);
});

test('the suggested lesson is offered on the way out, when there is one', async () => {
  const onLesson = vi.fn();
  render(<FixItDrill drill={drill()} onBanked={() => {}} onDone={() => {}} onLesson={onLesson} textEntry />);
  await playThrough();
  await userEvent.click(screen.getByRole('button', { name: /back to the path/i }));
  expect(onLesson).toHaveBeenCalledWith('1.3.1');
});
