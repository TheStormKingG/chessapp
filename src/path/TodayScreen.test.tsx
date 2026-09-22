import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { db, emptyProgress, saveResume, useProgress, type Progress } from '@/data';
import { SECTIONS } from '@/path/curriculum';
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
  // "Everything built" is now all fourteen units -- Section 1's six and all
  // eight of Section 2. Passing 1.1 and 1.2 leaves unit 1.3 to do, and Today
  // must say so. The finished fixture below walks the declared sections and
  // asks each unit whether it is built, rather than naming Section 1: naming
  // it was correct exactly while no Section 2 unit was built, and would have
  // left 2.1.1 to do while this test asserted there was nothing left.
  const throughUnit2 = emptyProgress();
  throughUnit2.units['1.1'] = { passed: true, attempts: 1, failedAttempts: 0, testedOut: false };
  throughUnit2.units['1.2'] = { passed: true, attempts: 1, failedAttempts: 0, testedOut: false };
  renderWith(throughUnit2);
  expect(screen.queryByText(FINISHED)).toBeNull();
  expect(screen.getByRole('link', { name: /Check and the three ways out/ })).toHaveAttribute(
    'href',
    '/lesson/1.3.1',
  );
  cleanup();

  const finished = emptyProgress();
  const built = SECTIONS.flatMap((s) => s.units).filter((u) => u.built);
  expect(built.map((u) => u.id)).toEqual([
    '1.1',
    '1.2',
    '1.3',
    '1.4',
    '1.5',
    '1.6',
    '2.1',
    '2.2',
    '2.3',
    '2.4',
    '2.5',
    '2.6',
    '2.7',
    '2.8',
  ]);
  for (const u of built) {
    finished.units[u.id] = { passed: true, attempts: 1, failedAttempts: 0, testedOut: false };
  }
  renderWith(finished);
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

test('the lesson card carries the next lesson\'s own position as a 120px decorative board', async () => {
  // PREMIUM-DELTA Δ4.4: Today had no chess on it at all. The board is the
  // lesson's OWN opening position, not a generic diagram -- lesson 1.1.1 is
  // about the empty grid and shows the empty grid.
  renderWith(emptyProgress());
  const root = await screen.findByTestId('today-lesson-board');
  expect(root.style.width).toBe('120px');
  expect(root).toHaveAttribute('data-fen', '8/8/8/8/8/8/8/8 w - - 0 1');
});

test('Today\'s board is decorative: the card stays a single destination', async () => {
  // The board sits INSIDE the lesson link. If it kept the full board's
  // `application` role, tab stop and live region, Today would gain a second
  // tab stop inside one link and announce a playable board that is not
  // playable. This is the assertion that stops that regression.
  renderWith(emptyProgress());
  await screen.findByTestId('today-lesson-board');
  expect(screen.queryByRole('application')).toBeNull();
  expect(screen.queryByRole('status', { name: 'Board announcements' })).toBeNull();
  const link = screen.getByRole('link', { name: /The board/ });
  expect(link.querySelectorAll('[tabindex]')).toHaveLength(0);
  // Negative control: the link itself is still the one thing that is reachable
  // and still names the lesson, so an empty result above cannot mean "the card
  // never rendered".
  expect(link).toHaveAttribute('href', '/lesson/1.1.1');
});

test('a checkpoint card carries no board', async () => {
  // The delta asks for the next LESSON's position. A checkpoint has no single
  // opening position, so it gets none -- without this, `activeNode` returning a
  // checkpoint would either crash the loader or show a stale lesson's board.
  const p = emptyProgress();
  for (const id of ['1.1.1', '1.1.2', '1.1.3', '1.1.4', '1.1.5', '1.1.6', '1.1.7', '1.1.8']) {
    p.lessons[id] = { stars: 3, completed: true };
  }
  renderWith(p);
  await screen.findByRole('link', { name: /checkpoint/i });
  expect(screen.queryByTestId('today-lesson-board')).toBeNull();
});

/*
 * NEUMORPHIC-DELTA.md §7.3. The three regions the desktop layout adds. They are
 * `hidden` below `xl` in CSS and therefore absent from the phone, but jsdom
 * applies no stylesheet, so what these tests pin is the CONTENT and its
 * accessible name -- the geometry half is measured in
 * `tests/audit-platform/desktop.spec.ts`, where a real browser applies the CSS.
 *
 * Every figure below is derived from the same `Progress` projection the Path
 * reads. Nothing here is persisted, and nothing is invented: the day streak the
 * delta's wireframe sketches has no per-day history behind it in `Progress`, so
 * it is not rendered at all rather than estimated.
 */

test('the secondary column counts the active unit in words before it draws a meter', () => {
  const p = emptyProgress();
  p.lessons['1.1.1'] = { stars: 3, completed: true };
  p.lessons['1.1.2'] = { stars: 2, completed: true };
  renderWith(p);
  const unit = screen.getByRole('region', { name: 'This unit' });
  // Unit 1.1 has eight lessons; two are done.
  expect(unit).toHaveTextContent('2 of 8 lessons done');
});

test('Up next reads the two nodes after the active one, and is not a second set of links', () => {
  renderWith(emptyProgress());
  const next = screen.getByRole('region', { name: 'Up next' });
  const items = next.querySelectorAll('li');
  expect([...items].map((li) => li.textContent?.replace(/\s+/g, ' '))).toEqual([
    '1.1.2 The rook',
    '1.1.3 The bishop',
  ]);
  // The Path tab owns navigating the path: these rows carry no link and no tab
  // stop, so Today does not grow a third route to the same place.
  expect(next.querySelectorAll('a')).toHaveLength(0);
});

test('Recently finished lists finished lessons newest first, with the star count in words', () => {
  const p = emptyProgress();
  p.lessons['1.1.1'] = { stars: 3, completed: true };
  p.lessons['1.1.2'] = { stars: 1, completed: true };
  renderWith(p);
  const band = screen.getByRole('region', { name: 'Recently finished' });
  const rows = [...band.querySelectorAll('li')].map((li) => li.textContent?.replace(/\s+/g, ' ').trim());
  expect(rows).toEqual(['1.1.2 The rook 1 star', '1.1.1 The board 3 stars']);
});

test('the band is absent rather than empty before anything is finished', () => {
  renderWith(emptyProgress());
  expect(screen.queryByRole('region', { name: 'Recently finished' })).toBeNull();
});
