import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { CheckpointBank } from '@/lesson';
import { emptyProgress, useProgress } from '@/data';
import { CheckpointRoute } from './CheckpointRoute';

const FEN = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';

const bank: CheckpointBank = {
  unit: '9.9',
  title: 'Unit 9.9 checkpoint',
  passMark: 0.75,
  sample: 2,
  bank: [
    {
      id: 'cp1',
      type: 'name_the_pattern',
      fen: FEN,
      prompt: 'Which is it?',
      concept: 'x',
      options: ['Fork', 'Pin', 'Skewer'],
      answer: { option: 1 },
    },
    {
      id: 'cp2',
      type: 'name_the_pattern',
      fen: FEN,
      prompt: 'And this one?',
      concept: 'y',
      options: ['Fork', 'Pin', 'Skewer'],
      answer: { option: 0 },
    },
  ],
};

vi.mock('@/lesson', async (orig) => ({
  ...(await orig<typeof import('@/lesson')>()),
  loadCheckpoint: () => Promise.resolve(bank),
}));

async function playToCloseScreen() {
  useProgress.setState({ progress: emptyProgress() });
  render(
    <MemoryRouter initialEntries={['/checkpoint/9.9']}>
      <Routes>
        <Route path="/checkpoint/:unit" element={<CheckpointRoute />} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole('button', { name: /start the checkpoint/i }));
  await userEvent.click(screen.getByRole('button', { name: /^start$/i }));
  // The sample is shuffled, so answer whichever of the two comes up.
  for (let i = 0; i < bank.sample; i++) {
    const pin = screen.queryByText('Which is it?');
    await userEvent.click(screen.getByRole('button', { name: pin ? 'Pin' : 'Fork' }));
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
  }
}

test('the checkpoint close screen does not borrow the lesson wording', async () => {
  await playToCloseScreen();
  expect(screen.getByRole('heading', { name: 'Checkpoint complete' })).toBeInTheDocument();
  expect(screen.queryByText('Lesson done')).toBeNull();
  // The checkpoint's XP is awarded on the result screen, so the player must not
  // claim the synthesised lesson's.
  expect(screen.queryByText(/XP/)).toBeNull();
  expect(screen.queryByRole('button', { name: /back to the path/i })).toBeNull();
  expect(screen.getByRole('button', { name: /see your score/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Exit checkpoint' })).toBeInTheDocument();
});

test('the score screen follows the close screen', async () => {
  await playToCloseScreen();
  await userEvent.click(screen.getByRole('button', { name: /see your score/i }));
  expect(await screen.findByRole('heading', { name: 'Checkpoint passed' })).toBeInTheDocument();
  expect(screen.getByText(/\+50 XP/)).toBeInTheDocument();
});
