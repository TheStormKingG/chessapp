import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LessonPlayer } from './LessonPlayer';
import type { Lesson } from './types';

const FEN = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';

const lesson: Lesson = {
  id: '9.9.1',
  unit: '9.9',
  title: 'Test lesson',
  xp: 10,
  card: { idea: 'An idea', diagrams: [] },
  explain: [{ fen: FEN, text: 'Explain this' }],
  challenges: [
    {
      id: 'c1',
      type: 'name_the_pattern',
      fen: FEN,
      prompt: 'Which is it?',
      concept: 'x',
      options: ['Fork', 'Pin', 'Skewer'],
      answer: { option: 1 },
      reason: 'A pin.',
    },
    {
      id: 'c2',
      type: 'which_square',
      fen: FEN,
      prompt: 'Type e4',
      concept: 'x',
      answer: { square: 'e4' },
    },
  ],
  takeaway: 'Remember this.',
};

test('plays a lesson through to the close screen', async () => {
  const onComplete = vi.fn();
  render(<LessonPlayer lesson={lesson} onComplete={onComplete} onExit={() => {}} textEntry />);
  expect(screen.getByText('An idea')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /start/i }));
  expect(screen.getByText('Explain this')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /next/i }));

  expect(screen.getByText('Which is it?')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Fork' }));
  expect(screen.getByText(/try again/i)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Pin' }));
  expect(screen.getByText('A pin.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /next/i }));

  await userEvent.type(screen.getByLabelText('Type a move'), 'e4{enter}');
  await userEvent.click(screen.getByRole('button', { name: /next/i }));

  expect(screen.getByText('Remember this.')).toBeInTheDocument();
  // One miss, no hints: a clean-enough run is three stars (stars.ts / PRD 7.3).
  expect(screen.getByText(/3 stars · 0 hints · 1 misses/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /back to the path/i }));
  expect(onComplete).toHaveBeenCalledWith(
    expect.objectContaining({ lessonId: '9.9.1', stars: 3, xp: 10 }),
  );
});

test('the hint control states its cost to a screen reader, not only on hover', async () => {
  render(<LessonPlayer lesson={lesson} onComplete={() => {}} onExit={() => {}} textEntry />);
  await userEvent.click(screen.getByRole('button', { name: /start/i }));
  await userEvent.click(screen.getByRole('button', { name: /next/i }));
  const hint = screen.getByRole('button', { name: 'Hint' });
  const describedBy = hint.getAttribute('aria-describedby');
  expect(describedBy).toBeTruthy();
  const note = document.getElementById(describedBy!);
  expect(note).toHaveTextContent(/no mastery credit/i);
});

test('exiting calls onExit without completing the lesson', async () => {
  const onExit = vi.fn();
  const onComplete = vi.fn();
  render(<LessonPlayer lesson={lesson} onComplete={onComplete} onExit={onExit} />);
  await userEvent.click(screen.getByRole('button', { name: 'Exit lesson' }));
  expect(onExit).toHaveBeenCalledTimes(1);
  expect(onComplete).not.toHaveBeenCalled();
});

const safeLesson: Lesson = {
  id: '9.9.2',
  unit: '9.9',
  title: 'Safety',
  xp: 5,
  card: { idea: 'Check before you move', diagrams: [] },
  explain: [],
  challenges: [
    {
      id: 's1',
      type: 'is_it_safe',
      fen: FEN,
      prompt: 'Is Ke2 safe?',
      concept: 'safety',
      move: 'Ke2',
      reasons: ['Nothing attacks it', 'It is defended', 'A pawn takes it'],
      answer: { safe: true, reason: 0 },
      reason: 'Nothing can reach e2.',
    },
  ],
  takeaway: 'Look before you leap.',
};

test('is_it_safe asks the verdict first, then the reason', async () => {
  render(<LessonPlayer lesson={safeLesson} onComplete={() => {}} onExit={() => {}} />);
  await userEvent.click(screen.getByRole('button', { name: /start/i }));

  // Step one: only the verdict is on offer.
  expect(screen.queryByRole('button', { name: 'Nothing attacks it' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'No, it is not safe' }));

  // Step two: the three reasons, under a heading that reflects the verdict.
  expect(screen.getByRole('group', { name: 'Why is it not safe?' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Nothing attacks it' }));
  expect(screen.getByText(/try again/i)).toBeInTheDocument();

  // A wrong answer returns to the verdict step, so the retry is a fresh choice.
  await userEvent.click(screen.getByRole('button', { name: 'Yes, it is safe' }));
  await userEvent.click(screen.getByRole('button', { name: 'Nothing attacks it' }));
  expect(screen.getByText('Nothing can reach e2.')).toBeInTheDocument();
});
