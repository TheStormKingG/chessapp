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

  // Step two: the three reasons, under a neutral heading that does not restate
  // (and so give away) the verdict.
  expect(screen.getByRole('group', { name: 'Why?' })).toBeInTheDocument();
  expect(screen.getByText(/You said:/)).toHaveTextContent('No, it is not safe');
  await userEvent.click(screen.getByRole('button', { name: 'Nothing attacks it' }));
  expect(screen.getByText(/try again/i)).toBeInTheDocument();

  // A wrong answer returns to the verdict step, so the retry is a fresh choice.
  await userEvent.click(screen.getByRole('button', { name: 'Yes, it is safe' }));
  await userEvent.click(screen.getByRole('button', { name: 'Nothing attacks it' }));
  expect(screen.getByText('Nothing can reach e2.')).toBeInTheDocument();
});

/* --------------------------------------------------- interruption and focus */

test('resumes at the challenge the learner was on', () => {
  render(
    <LessonPlayer
      lesson={lesson}
      onComplete={() => {}}
      onExit={() => {}}
      textEntry
      resume={{
        lessonId: '9.9.1',
        challengeId: 'c2',
        index: 1,
        challengeCount: 2,
        results: { c1: { correct: true, hints: 0, misses: 1, mastery: false } },
        totalHints: 0,
        totalMisses: 1,
        savedAt: '2026-09-17T00:00:00.000Z',
      }}
    />,
  );
  expect(screen.getByText('Type e4')).toBeInTheDocument();
  expect(screen.getByText('2 of 2')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^start$/i })).toBeNull();
});

test('a resume record whose lesson has changed underneath it is ignored', () => {
  render(
    <LessonPlayer
      lesson={lesson}
      onComplete={() => {}}
      onExit={() => {}}
      textEntry
      resume={{
        lessonId: '9.9.1',
        challengeId: 'gone',
        index: 1,
        challengeCount: 2,
        results: {},
        totalHints: 0,
        totalMisses: 0,
        savedAt: '2026-09-17T00:00:00.000Z',
      }}
    />,
  );
  expect(screen.getByRole('button', { name: /^start$/i })).toBeInTheDocument();
});

test('reports a resume point as each challenge is reached, and clears it at the close', async () => {
  const onProgress = vi.fn();
  render(
    <LessonPlayer
      lesson={lesson}
      onComplete={() => {}}
      onExit={() => {}}
      textEntry
      onProgress={onProgress}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: /^start$/i }));
  await userEvent.click(screen.getByRole('button', { name: /next/i }));
  expect(onProgress).toHaveBeenLastCalledWith(
    expect.objectContaining({ lessonId: '9.9.1', challengeId: 'c1', index: 0, challengeCount: 2 }),
  );

  await userEvent.click(screen.getByRole('button', { name: 'Pin' }));
  await userEvent.click(screen.getByRole('button', { name: /next/i }));
  expect(onProgress).toHaveBeenLastCalledWith(
    expect.objectContaining({ challengeId: 'c2', index: 1 }),
  );

  await userEvent.type(screen.getByLabelText('Type a move'), 'e4{enter}');
  await userEvent.click(screen.getByRole('button', { name: /next/i }));
  expect(screen.getByText('Remember this.')).toBeInTheDocument();
  expect(onProgress).toHaveBeenLastCalledWith(null);
});

test('focus lands on the new challenge when the lesson advances', async () => {
  render(<LessonPlayer lesson={lesson} onComplete={() => {}} onExit={() => {}} textEntry />);
  await userEvent.click(screen.getByRole('button', { name: /^start$/i }));
  await userEvent.click(screen.getByRole('button', { name: /next/i }));

  // Positive, scalar assertions on the focus owner (observation 0079).
  expect(document.activeElement?.id).toBe('challenge-prompt');
  expect(document.activeElement).toHaveTextContent('Which is it?');

  await userEvent.click(screen.getByRole('button', { name: 'Pin' }));
  await userEvent.click(screen.getByRole('button', { name: /next/i }));
  expect(document.activeElement?.id).toBe('challenge-prompt');
  expect(document.activeElement).toHaveTextContent('Type e4');
});

test('the challenge transition is announced to a screen reader', async () => {
  render(<LessonPlayer lesson={lesson} onComplete={() => {}} onExit={() => {}} textEntry />);
  await userEvent.click(screen.getByRole('button', { name: /^start$/i }));
  await userEvent.click(screen.getByRole('button', { name: /next/i }));
  const live = screen.getByRole('status', { name: 'Challenge progress' });
  expect(live).toHaveAttribute('aria-live', 'polite');
  expect(live).toHaveTextContent('1 of 2');
});

test('leaving mid-challenge warns first and says the place is saved', async () => {
  const onExit = vi.fn();
  render(
    <LessonPlayer
      lesson={lesson}
      onComplete={() => {}}
      onExit={onExit}
      textEntry
      onProgress={() => {}}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: /^start$/i }));
  await userEvent.click(screen.getByRole('button', { name: /next/i }));

  await userEvent.click(screen.getByRole('button', { name: 'Exit lesson' }));
  expect(onExit).not.toHaveBeenCalled();
  expect(screen.getByRole('heading', { name: 'Leave the lesson?' })).toBeInTheDocument();
  expect(screen.getByText(/saved/i)).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Keep going' }));
  expect(onExit).not.toHaveBeenCalled();
  expect(screen.getByText('Which is it?')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Exit lesson' }));
  await userEvent.click(screen.getByRole('button', { name: 'Leave' }));
  expect(onExit).toHaveBeenCalledTimes(1);
});
