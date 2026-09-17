import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { db, emptyProgress, saveResume, useProgress } from '@/data';
import { PathScreen } from './PathScreen';

beforeEach(async () => {
  await db.resume.clear();
  // A place is mirrored to localStorage as well (resume.ts), so "no saved
  // place" means clearing both stores, not just the database.
  localStorage.clear();
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

/* ------------------------------------------------------------------- C2 */

test('"Locked" is said once on the group boundary, not once per node', () => {
  renderPath();
  // 1.1.2 to 1.1.8 and 1.2.1 to 1.2.5 are all locked on a fresh path: twelve
  // nodes that used to print the same word twelve times.
  expect(screen.getAllByText('Locked until you get there')).toHaveLength(2);
  expect(screen.queryAllByText('Locked')).toHaveLength(0);
});

test('every locked node keeps its accessible name verbatim', () => {
  renderPath();
  // tests/audit/path-today.spec.ts:43 asserts this exact string end to end.
  // The visible subtitle moved to a boundary; the name did not move with it.
  for (const name of ['1.1.2 The rook. Locked', '1.1.8 Setting up the board. Locked']) {
    expect(screen.getByLabelText(name)).toHaveAttribute('aria-disabled', 'true');
  }
});

test('the checkpoint carries a vector symbol, and no emoji survives the screen', () => {
  const { container } = render(
    <MemoryRouter>
      <PathScreen />
    </MemoryRouter>,
  );
  expect(container.querySelector('svg')).toBeInTheDocument();
  // The one structural icon this screen used to render was U+1F3C1. Any
  // pictographic codepoint here is the same defect returning under a new glyph.
  expect(container.textContent ?? '').not.toMatch(/\p{Extended_Pictographic}/u);
});

test('every node is indexed by its own rail number', () => {
  renderPath();
  const rail = [...document.querySelectorAll('[data-rail="index"]')].map((e) => e.textContent);
  expect(rail.slice(0, 3)).toEqual(['1.1.1', '1.1.2', '1.1.3']);
  // The rail is decoration over information the accessible name already
  // carries, so it is hidden rather than announced twice.
  for (const cell of document.querySelectorAll('[data-rail="index"]')) {
    expect(cell).toHaveAttribute('aria-hidden', 'true');
  }
});
