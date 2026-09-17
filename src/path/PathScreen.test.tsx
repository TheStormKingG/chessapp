import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { db, emptyProgress, saveResume, useProgress } from '@/data';
import { PathScreen } from './PathScreen';

beforeEach(async () => {
  await db.resume.clear();
  useProgress.setState({ progress: emptyProgress() });
});

function renderPath() {
  render(
    <MemoryRouter>
      <PathScreen />
    </MemoryRouter>,
  );
}

test('an untouched active lesson still reads "Up next"', async () => {
  renderPath();
  expect(await screen.findByRole('link', { name: '1.1.1 The board. Up next' })).toBeInTheDocument();
});

test('a lesson left part-way reads as in progress and offers to resume', async () => {
  await saveResume({
    lessonId: '1.1.1',
    challengeId: 'c3',
    index: 2,
    challengeCount: 8,
    results: {},
    totalHints: 0,
    totalMisses: 0,
    savedAt: new Date().toISOString(),
  });
  renderPath();
  expect(
    await screen.findByRole('link', { name: '1.1.1 The board. In progress · 3 of 8. Resume' }),
  ).toBeInTheDocument();
  expect(screen.getByText('In progress · 3 of 8')).toBeInTheDocument();
});

test('a stale record falls back to the current wording', async () => {
  await saveResume({
    lessonId: '1.1.1',
    challengeId: 'c3',
    index: 99,
    challengeCount: 8,
    results: {},
    totalHints: 0,
    totalMisses: 0,
    savedAt: new Date().toISOString(),
  });
  renderPath();
  expect(await screen.findByRole('link', { name: '1.1.1 The board. Up next' })).toBeInTheDocument();
});
