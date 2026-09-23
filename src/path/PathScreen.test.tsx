import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { db, emptyProgress, saveResume, useProgress } from '@/data';
import { SECTION_2 } from './curriculum';
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

test('a locked run states how long it is, and never says "Locked" per node', () => {
  renderPath();
  // 1.1.2 to 1.1.8 and 1.2.1 to 1.2.5 are all locked on a fresh path: twelve
  // nodes that used to print the same word twelve times.
  //
  // PREMIUM-DELTA.md Δ3 changed the boundary's wording, and this spec changes
  // with it by design -- it encoded the *fix* for the per-node repetition, not
  // the sentence. "Locked until you get there" was identical on both runs, so
  // it was a section heading printed twice; the counts differ, and the count is
  // the distance between the learner and the next thing that opens.
  //
  // All fourteen units are built, so a fresh path has FOURTEEN locked runs,
  // one per unit, broken apart by the checkpoints between them (a built unit's
  // checkpoint is attemptable, never locked).
  // Asserting the whole sequence in path order pins both the counts and the
  // boundaries -- `getByText('5 locked')` could no longer be unambiguous once
  // three units run five lessons long.
  const runs = [...document.querySelectorAll('*')]
    .filter((el) => el.children.length === 0 && /^\d+ locked$/.test(el.textContent ?? ''))
    .map((el) => el.textContent);
  expect(runs).toEqual([
    '7 locked',
    '5 locked',
    '5 locked',
    '3 locked',
    '5 locked',
    '3 locked',
    '5 locked',
    '4 locked',
    '5 locked',
    '5 locked',
    '3 locked',
    '5 locked',
    '6 locked',
    '3 locked',
  ]);
  // 64 locked lessons = Section 1's 29 plus Section 2's 36, minus the active
  // one. Every authoring pass moved one run out of the `coming` list and into
  // this one; with unit 2.8 flipped on, that list is now empty for real.
  expect(runs.reduce((n, r) => n + Number(r!.split(' ')[0]), 0)).toBe(64);
  expect(screen.queryAllByText('Locked until you get there')).toHaveLength(0);
  // Line 67's original guarantee, unchanged: the word is still never printed
  // once per node, which is what chunk C2 bought.
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

/* ------------------------------------------------ PREMIUM-DELTA.md Δ3, Δ5 */

test('progress is a count first and a meter second', () => {
  renderPath();
  // Δ3: the meter is aria-hidden decoration, so the count has to be real text
  // or the screen conveys progress by colour and height alone. A fresh path has
  // nothing done and still states the total.
  expect(screen.getByText('0 of 29 done')).toBeInTheDocument();
  const meter = document.querySelector('[data-rail="meter"]');
  expect(meter).toHaveAttribute('aria-hidden', 'true');
  expect(meter).toHaveAttribute('data-fill', '0');
});

test('the meter fills as lessons are finished, and tested out counts as done', () => {
  useProgress.setState({
    progress: {
      ...emptyProgress(),
      lessons: { '1.1.1': { completed: true, stars: 3 } },
    },
  });
  renderPath();
  expect(screen.getByText('1 of 29 done')).toBeInTheDocument();
  expect(document.querySelector('[data-rail="meter"]')).toHaveAttribute('data-fill', '3');
});

test('a finished node is quiet, and says so in three channels that are not colour', () => {
  useProgress.setState({
    progress: {
      ...emptyProgress(),
      lessons: { '1.1.1': { completed: true, stars: 3 } },
    },
  });
  renderPath();
  // Δ3: fill, weight and a glyph. The glyph is the one a screenshot can lose
  // its colour and still read.
  const done = screen.getByRole('link', { name: '1.1.1 The board. 3 stars' });
  expect(done.textContent).toContain('\u2713');
  // Δ1 rule 2: the --key-accent edge belongs to the one thing to do next, and
  // to nothing else on the screen. A finished node must not wear it, or the
  // hierarchy PREMIUM-DELTA.md §3.3 measured stays inverted.
  expect(done.querySelector('.border-b-key-accent')).toBeNull();
  const next = screen.getByRole('link', { name: '1.1.2 The rook. Up next' });
  expect(next.querySelector('.border-b-key-accent')).not.toBeNull();
});

test('only the active node carries the key-accent edge, once per screen', () => {
  renderPath();
  expect(document.querySelectorAll('.border-b-key-accent')).toHaveLength(1);
});

test('the card edge has left the screen, so no row can ask for two bottom edges', () => {
  // The previous form of this test asserted that no element carried BOTH
  // `border-b-key-raised` and `border-b-key-accent` -- two utilities setting the
  // same property, with Tailwind's emission order silently deciding the winner,
  // which had left the active node wearing an ordinary card edge.
  //
  // NEUMORPHIC-DELTA.md §6 removed `--key-raised` outright, so that assertion
  // would now pass over an empty set: it would be green whether the rule held or
  // the screen had no rows at all. It is replaced by the stronger claim the
  // removal actually makes -- the class appears nowhere -- with the row count
  // asserted first so the probe cannot report clean by matching nothing.
  renderPath();
  expect(document.querySelectorAll('[class*="border-b-"]').length).toBeGreaterThan(0);
  expect(document.querySelectorAll('[class*="key-raised"]')).toHaveLength(0);
  expect(document.querySelectorAll('.border-b-key-accent')).toHaveLength(1);
});

test('the locked run is a groove and the rows that can be pressed are raised', () => {
  // Chunk N3's depth grammar, asserted as structure rather than as a screenshot:
  // exactly one thing on this screen is cut into the ground, and it is the run
  // nobody can act on.
  renderPath();
  const grooves = document.querySelectorAll('.n-inset-soft');
  expect(grooves.length).toBeGreaterThan(0);
  for (const g of grooves) {
    expect(g.querySelector('a')).toBeNull();
  }
  // SCOPED, not loosened. The claim is "a row that can be pressed is raised",
  // and the raise is now carried by `n-panel` on the node card -- the
  // card-scale shadow measured off the reference's panel -- where it used to be
  // `n-raised`, which is the reference's PILL scale and stays on pill-sized
  // things. Both are raises, so both satisfy the rule and the selector names
  // both; pinning it to one class name would have been asserting the
  // implementation rather than the grammar, which is what let this break on a
  // rename that changed nothing about the design.
  const raised = document.querySelectorAll('.n-panel, .n-raised');
  expect(raised.length).toBeGreaterThan(0);
  // ...and a raised row is never inside the groove, which is the half of the
  // grammar the count alone does not check.
  for (const r of raised) {
    expect(r.closest('.n-inset-soft')).toBeNull();
  }
});

test('--accent-soft has left this screen', () => {
  // PREMIUM-DELTA.md §5: the tested-out node is one of the four jobs the token
  // loses. Passing the 1.1 checkpoint is what produces tested-out lessons.
  useProgress.setState({
    progress: { ...emptyProgress(), units: { '1.1': { passed: true, attempts: 1, failedAttempts: 0, testedOut: true } } },
  });
  renderPath();
  expect(screen.getByRole('link', { name: '1.1.1 The board. Tested out' })).toBeInTheDocument();
  expect(document.querySelectorAll('[class*="accent-soft"]')).toHaveLength(0);
});

test('a node finished on one star says "1 star", not "1 stars"', () => {
  useProgress.setState({
    progress: {
      ...emptyProgress(),
      lessons: { '1.1.1': { completed: true, stars: 1 } },
    },
  });
  renderPath();
  expect(screen.getByRole('link', { name: '1.1.1 The board. 1 star' })).toBeInTheDocument();
});

/* ----------------------------------------------- one header per section */

test('every section on the path gets its own header, in path order', () => {
  renderPath();
  // The header used to be a single hardcoded `Section 1`. Section 2 is declared
  // and now rendered, so it owes the same three lines in the same words.
  expect(screen.getByText('Section 1 · New to 400')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Foundations' })).toBeInTheDocument();
  expect(screen.getByText('Section 2 · 400 to 800')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Safety and the first tactics' })).toBeInTheDocument();
  // Path order, not declaration luck.
  const headings = screen.getAllByRole('heading').map((h) => h.textContent);
  expect(headings).toEqual(['Foundations', 'Safety and the first tactics']);
  // One `h1` per screen: the sections rank equally, so the rest are `h2` at the
  // same `t-display` size. Level order stays valid for a screen reader.
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Foundations');
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
    'Safety and the first tactics',
  );
});

test('the meter counts the section it sits beside, not the whole path', () => {
  renderPath();
  // A single path-wide meter would read "0 of 65 done" under a Section 1
  // heading -- wrong about the heading and wrong about the work. One meter per
  // section, counting that section's lessons.
  expect(screen.getByText('0 of 29 done')).toBeInTheDocument();
  expect(screen.getByText('0 of 36 done')).toBeInTheDocument();
  const meters = [...document.querySelectorAll('[data-rail="meter"]')];
  expect(meters).toHaveLength(2);
  for (const m of meters) expect(m).toHaveAttribute('data-fill', '0');
});

test('nothing on the path reads as coming now that every unit is built', () => {
  renderPath();
  // SCOPED, not deleted, through five authoring passes: this counted 27 coming
  // nodes across units 2.4 to 2.8, then fewer, and now none. The claim is the
  // same one it always made -- unauthored content is un-attemptable -- and it
  // is satisfied by there being no unauthored content.
  const coming = [...document.querySelectorAll('*')]
    .filter((el) => el.children.length === 0 && /^\d+ coming$/.test(el.textContent ?? ''))
    .map((el) => el.textContent);
  expect(coming).toEqual([]);
  // `aria-disabled` is NOT the discriminator: a locked lesson carries it too,
  // and all 64 of them do. "Content coming" is the label a coming node alone
  // gets, so that is what must be absent.
  expect(screen.queryByLabelText(/Content coming/)).toBeNull();
  // The control for the emptiness above: the screen did render a path, and
  // the units that used to be coming are now real, named, reachable nodes.
  expect(screen.getByLabelText(/^2\.4\.1 The back-rank weakness/)).toBeInTheDocument();
  expect(screen.getByLabelText(/^2\.8\.3 Going over your own game/)).toBeInTheDocument();
});

test('an unbuilt run still counts per unit, and nothing in it is a link', () => {
  // The groove rule this guards -- a coming run breaks at the unit boundary,
  // so the path prints "3 coming" for one unit rather than "44 coming" for the
  // rest of the curriculum -- lost its last real instance when 2.8 was flipped
  // on. It is the rule that will be wrong first when Section 3 is declared, so
  // it stays armed against a synthetic unbuilt unit rather than being deleted
  // with the content that happened to exercise it.
  const u27 = SECTION_2.units.find((u) => u.id === '2.7')!;
  const u28 = SECTION_2.units.find((u) => u.id === '2.8')!;
  u27.built = false;
  u28.built = false;
  try {
    renderPath();
    const coming = [...document.querySelectorAll('*')]
      .filter((el) => el.children.length === 0 && /^\d+ coming$/.test(el.textContent ?? ''))
      .map((el) => el.textContent);
    // Two units, two grooves. The fused form -- one run spanning the boundary
    // -- is what the "44 coming" defect looked like, so it is named explicitly.
    expect(coming).not.toEqual(['11 coming']);
    // A coming checkpoint stays INSIDE its unit's groove rather than breaking
    // it, so each count is the unit's lessons plus its checkpoint: 2.7 is
    // 6 + 1 and 2.8 is 3 + 1, two rows rather than eleven.
    expect(coming).toEqual(['7 coming', '4 coming']);
    expect(
      screen.getByLabelText('2.7.1 What can and cannot mate. Content coming'),
    ).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('link', { name: /^2\.[78]/ })).toBeNull();
    // Control: the units left built are still real links, so "no links" above
    // is not the whole screen having failed to render.
    expect(screen.getByLabelText(/^2\.6\.1 Centre, development, castle early/)).toBeInTheDocument();
  } finally {
    u27.built = true;
    u28.built = true;
  }
});
