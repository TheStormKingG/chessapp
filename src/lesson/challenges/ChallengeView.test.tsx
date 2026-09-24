import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChallengeView } from './ChallengeView';
import type { Challenge } from '../types';

// The board is irrelevant to how the answer groups are labelled, and
// react-chessboard needs a laid-out DOM jsdom does not provide.
vi.mock('@/board', () => ({ Board: () => <div data-testid="board" /> }));

const noop = () => undefined;

function show(c: Challenge) {
  return render(
    <ChallengeView c={c} answeredFen={null}
      highlights={{}} refutation={null} busy={false} dispatch={noop} onWrongMove={noop} />,
  );
}

const pattern: Challenge = {
  id: 'p1',
  type: 'name_the_pattern',
  fen: '4k3/8/8/8/8/8/8/R1N1B1K1 w - - 0 1',
  prompt: 'Which of these is worth the most?',
  concept: 'values',
  options: ['Rook', 'Knight', 'Bishop'],
  answer: { option: 0 },
};

const safe: Challenge = {
  id: 's1',
  type: 'is_it_safe',
  fen: '6k1/3n4/8/4p3/4R3/8/8/4K3 w - - 0 1',
  move: 'Rxe5',
  prompt: 'The rook takes the pawn on e5. Is that safe?',
  concept: 'attack-defend',
  reasons: ['Nothing can reach e5.', 'The knight on d7 takes back.', 'The king on g8 takes back.'],
  answer: { safe: false, reason: 1 },
};

test('the name_the_pattern answer group is labelled with the question it answers', () => {
  show(pattern);
  expect(screen.getByRole('group', { name: pattern.prompt })).toBeInTheDocument();
});

test('the is_it_safe verdict group is labelled with the question it answers', () => {
  show(safe);
  expect(screen.getByRole('group', { name: safe.prompt })).toBeInTheDocument();
});

test('the reason step asks "Why?" without restating a verdict', async () => {
  const user = userEvent.setup();
  show(safe);
  await user.click(screen.getByRole('button', { name: 'Yes, it is safe' }));
  expect(screen.getByRole('group', { name: 'Why?' })).toBeInTheDocument();
  expect(screen.queryByRole('group', { name: /Why is it/ })).not.toBeInTheDocument();
});

test('a mis-tapped verdict can be taken back', async () => {
  const user = userEvent.setup();
  show(safe);
  await user.click(screen.getByRole('button', { name: 'Yes, it is safe' }));
  await user.click(screen.getByRole('button', { name: 'Change answer' }));
  expect(screen.getByRole('group', { name: safe.prompt })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'No, it is not safe' })).toBeInTheDocument();
});
