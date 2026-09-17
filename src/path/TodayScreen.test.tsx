import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { db, emptyProgress, saveResume, useProgress, type Progress } from '@/data';
import { TodayScreen } from '@/screens/TodayScreen';

const FINISHED = 'You have finished everything that is built so far. More lessons are coming.';

function renderWith(p: Progress) {
  useProgress.setState({ progress: p });
  render(
    <MemoryRouter>
      <TodayScreen />
    </MemoryRouter>,
  );
}

test('Today names the checkpoint once a unit\'s lessons are all done', () => {
  const p = emptyProgress();
  for (const id of ['1.1.1', '1.1.2', '1.1.3', '1.1.4', '1.1.5', '1.1.6', '1.1.7', '1.1.8']) {
    p.lessons[id] = { stars: 3, completed: true };
  }
  renderWith(p);
  const link = screen.getByRole('link', { name: /checkpoint/i });
  expect(link).toHaveAttribute('href', '/checkpoint/1.1');
  expect(screen.queryByText(FINISHED)).toBeNull();
});

test('Today names the active lesson', () => {
  renderWith(emptyProgress());
  expect(screen.getByRole('link', { name: /The board/ })).toHaveAttribute('href', '/lesson/1.1.1');
  expect(screen.queryByText(FINISHED)).toBeNull();
});

test('the terminal message appears only when everything built is finished', () => {
  const p = emptyProgress();
  p.units['1.1'] = { passed: true, attempts: 1, failedAttempts: 0, testedOut: false };
  p.units['1.2'] = { passed: true, attempts: 1, failedAttempts: 0, testedOut: false };
  renderWith(p);
  expect(screen.getByText(FINISHED)).toBeInTheDocument();
});

test('Today offers to resume a lesson left part-way, and says how far in', async () => {
  await db.resume.clear();
  // A place is mirrored to localStorage as well (resume.ts), so "no saved
  // place" means clearing both stores, not just the database.
  localStorage.clear();
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
  renderWith(emptyProgress());
  expect(await screen.findByText('In progress \u00b7 3 of 8')).toBeInTheDocument();
  const link = await screen.findByRole('link', { name: /Resume/ });
  expect(link).toHaveAttribute('href', '/lesson/1.1.1');
});

test('an untouched lesson is offered as a start, not a resumption', async () => {
  await db.resume.clear();
  // A place is mirrored to localStorage as well (resume.ts), so "no saved
  // place" means clearing both stores, not just the database.
  localStorage.clear();
  renderWith(emptyProgress());
  expect(await screen.findByText('Start this lesson')).toBeInTheDocument();
  expect(screen.queryByText(/In progress/)).toBeNull();
});
