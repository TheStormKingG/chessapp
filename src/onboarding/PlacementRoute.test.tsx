import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { emptyProgress, useProgress, type EventPayload } from '@/data';
import type { Challenge } from '@/lesson/types';
import { PlacementRoute } from './PlacementRoute';
import { PATH_UNITS } from './placement';
import { PLACEMENT_LADDER, RUNG_SIZE, type PlacementRung } from './placementBank';
import { useOnboarding } from './store';

const FEN = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';
const RIGHT = 'Pin';
const WRONG = 'Fork';

/**
 * Synthetic challenges, one shape, so a round can be passed or failed on
 * purpose. The REAL manifest ids are checked against the real banks in
 * `placementBank.test.ts`; what is under test here is the route's sequencing,
 * scoring and what it writes to the log, and three chess positions would make
 * that harder to read without testing any of it.
 */
function threeFor(unit: string): Challenge[] {
  return Array.from({ length: RUNG_SIZE }, (_, i) => ({
    id: `${unit}-q${i + 1}`,
    type: 'name_the_pattern' as const,
    fen: FEN,
    prompt: `${unit} question ${i + 1}`,
    concept: `c${i + 1}`,
    options: [WRONG, RIGHT, 'Skewer'] as [string, string, string],
    answer: { option: 1 },
  }));
}

function fiveRules(): Challenge[] {
  return Array.from({ length: 5 }, (_, i) => ({
    id: `rules-q${i + 1}`,
    type: 'name_the_pattern' as const,
    fen: FEN,
    prompt: `rules question ${i + 1}`,
    concept: `r${i + 1}`,
    options: [WRONG, RIGHT, 'Skewer'] as [string, string, string],
    answer: { option: 1 },
  }));
}

vi.mock('./placementContent', async (orig) => ({
  ...(await orig<typeof import('./placementContent')>()),
  loadRung: (rung: PlacementRung) => Promise.resolve(threeFor(rung.unit)),
  loadRulesCheck: () => Promise.resolve(fiveRules()),
}));

/** Every event the route appended, in order. */
function appended(): EventPayload[] {
  return log;
}
let log: EventPayload[] = [];

function mount() {
  useProgress.setState({ progress: emptyProgress() });
  return render(
    <MemoryRouter initialEntries={['/onboarding/placement']}>
      <Routes>
        <Route path="/onboarding/placement" element={<PlacementRoute />} />
        <Route path="/" element={<h1>Today</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Answer the `n` questions of the round on screen, then leave its close screen. */
async function answerRound(n: number, correctly: boolean) {
  for (let i = 0; i < n; i++) {
    if (correctly) {
      await userEvent.click(screen.getByRole('button', { name: RIGHT }));
    } else {
      // Two misses is a reveal, which scores nothing — the same rule a lesson
      // follows, so failing a round needs no special path through the player.
      await userEvent.click(screen.getByRole('button', { name: WRONG }));
      await userEvent.click(screen.getByRole('button', { name: WRONG }));
    }
    await userEvent.click(screen.getByRole('button', { name: /^next$/i }));
  }
  await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));
}

/** Start the placement test and answer every round the same way. */
async function runLadder(correctly: boolean) {
  mount();
  await userEvent.click(await screen.findByRole('button', { name: /^start$/i }));
  for (let round = 0; round < 4; round++) {
    await screen.findByRole('button', { name: RIGHT });
    await answerRound(RUNG_SIZE, correctly);
  }
  return screen.findByRole('heading', { name: 'Where you start' });
}

beforeEach(() => {
  useOnboarding.getState().reset();
  useOnboarding.getState().setLevel('casual');
  log = [];
  useProgress.setState({
    progress: emptyProgress(),
    loaded: true,
    append: async (p: EventPayload) => {
      log.push(p);
      return { id: String(log.length), deviceDay: '2026-01-01', createdAt: '', payload: p, synced: 0 as const };
    },
  });
});

/* ------------------------------------------------------------------- intro */

test('the placement test says how long it is and that each round follows the last', async () => {
  mount();
  expect(await screen.findByRole('heading', { name: 'Find your level' })).toBeInTheDocument();
  expect(screen.getByText(/12 questions/)).toBeInTheDocument();
  expect(screen.getByText(/4 rounds of 3/)).toBeInTheDocument();
  expect(screen.getByText(/chosen from how the last one went/)).toBeInTheDocument();
  // A way out that is a choice, not a dismissal.
  expect(screen.getByRole('button', { name: /skip and start at the beginning/i })).toBeInTheDocument();
});

test('the test can be left before it starts, and nothing is written', async () => {
  mount();
  await userEvent.click(await screen.findByRole('button', { name: /skip and start/i }));
  expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
  expect(appended()).toEqual([]);
  expect(useOnboarding.getState().placedUnit).toBeNull();
});

/* -------------------------------------------------------- the adaptive run */

test('the run is four rounds of three, with the rounds named as it goes', async () => {
  mount();
  await userEvent.click(await screen.findByRole('button', { name: /^start$/i }));
  for (let round = 1; round <= 4; round++) {
    // The player's title, which is also the check that a new round really began
    // rather than the previous one being re-rendered.
    expect(await screen.findByRole('heading', { name: `Placement · round ${round}` })).toBeInTheDocument();
    // Its own counter, which the player owns: three questions, not twelve.
    expect(screen.getByLabelText('Challenge progress')).toHaveTextContent('1 of 3');
    await answerRound(RUNG_SIZE, true);
  }
  expect(await screen.findByRole('heading', { name: 'Where you start' })).toBeInTheDocument();
});

test('the placement test asks no card screen, because its intro already said that', async () => {
  mount();
  await userEvent.click(await screen.findByRole('button', { name: /^start$/i }));
  // The first thing after Start is a question, not a "Start" on a card. The
  // positive control is the question itself: it is on screen, so the absence
  // below is a skipped card and not a screen that failed to render.
  expect(await screen.findByText('2.3 question 1')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^start$/i })).toBeNull();
});

test('each round is banked as attempts in the log as it finishes, under its own context', async () => {
  mount();
  await userEvent.click(await screen.findByRole('button', { name: /^start$/i }));
  await screen.findByRole('button', { name: RIGHT });
  await answerRound(RUNG_SIZE, true);
  const attempts = appended().filter((e) => e.type === 'challenge_attempted');
  expect(attempts).toHaveLength(RUNG_SIZE);
  for (const a of attempts) {
    expect(a).toMatchObject({ context: 'placement', lessonId: '2.3', mastery: true });
  }
  // And nothing has been decided yet: the tested-out events are the commit.
  expect(appended().filter((e) => e.type === 'unit_tested_out')).toEqual([]);
});

test('hints are off, as they are in a checkpoint', async () => {
  mount();
  await userEvent.click(await screen.findByRole('button', { name: /^start$/i }));
  await screen.findByRole('button', { name: RIGHT });
  expect(screen.queryByRole('button', { name: /hint/i })).toBeNull();
  // The positive control: the player's other mid-challenge control IS there, so
  // the query above was looking at a rendered challenge.
  expect(screen.getByRole('button', { name: /show me/i })).toBeInTheDocument();
});

/* ---------------------------------------------------------- the two edges */

test('clearing every round places the learner at the start of Section 4 and no further', async () => {
  await runLadder(true);
  expect(screen.getByText('4.1 Deflection and decoy')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(/Section 4/);
  expect(screen.getByRole('button', { name: 'Start at 4.1' })).toBeInTheDocument();
});

test('missing every round places the learner at the very first unit, with nothing tested out', async () => {
  await runLadder(false);
  expect(screen.getByText('1.1 The board and the pieces')).toBeInTheDocument();
  expect(screen.getByText('Nothing tested out')).toBeInTheDocument();
  // There is nothing earlier, so the control is absent rather than dead.
  expect(screen.queryByRole('button', { name: /start earlier/i })).toBeNull();
});

/* -------------------------------------------------------- the result screen */

test('the result says which unit and why in one sentence, in a live region', async () => {
  await runLadder(true);
  const why = screen.getByRole('status');
  expect(why).toHaveAttribute('aria-live', 'polite');
  expect(why.textContent ?? '').toMatch(/^You start at 4\.1 Deflection and decoy because .*\.$/);
  // Exactly one live region: the sentence that changes. The player's own
  // counter is gone with the player, so nothing competes with it.
  expect(screen.getAllByRole('status')).toHaveLength(1);
});

test('start earlier moves back one whole unit at a time and rewrites the reason', async () => {
  await runLadder(true);
  await userEvent.click(screen.getByRole('button', { name: 'Start earlier, at 3.12' }));
  expect(screen.getByText('3.12 Story games')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(/You chose to start at 3\.12 Story games/);
  expect(screen.getByRole('button', { name: 'Start at 3.12' })).toBeInTheDocument();
  // Repeatable, and one unit per press rather than a jump.
  await userEvent.click(screen.getByRole('button', { name: 'Start earlier, at 3.11' }));
  expect(screen.getByRole('button', { name: 'Start at 3.11' })).toBeInTheDocument();
});

test('the commit writes one tested-out event per unit before the placement, and nothing else', async () => {
  await runLadder(true);
  log = [];
  await userEvent.click(screen.getByRole('button', { name: 'Start at 4.1' }));
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
  });
  const testedOut = appended().filter((e) => e.type === 'unit_tested_out');
  const expected = PATH_UNITS.slice(0, PATH_UNITS.indexOf('4.1'));
  expect(testedOut.map((e) => (e.type === 'unit_tested_out' ? e.unit : ''))).toEqual(expected);
  // Non-vacuous, and the cap holds: every unit of Sections 1 to 3 and none of 4.
  expect(expected.length).toBeGreaterThan(20);
  expect(testedOut.map((e) => (e.type === 'unit_tested_out' ? e.unit : ''))).not.toContain('4.1');
  // The commit writes tested-out events only: the attempts were banked round by
  // round, so a second write here would double-count them.
  expect(appended().filter((e) => e.type !== 'unit_tested_out')).toEqual([]);
  expect(useOnboarding.getState().placedUnit).toBe('4.1');
});

test('start earlier changes what the commit writes', async () => {
  await runLadder(true);
  await userEvent.click(screen.getByRole('button', { name: 'Start earlier, at 3.12' }));
  log = [];
  await userEvent.click(screen.getByRole('button', { name: 'Start at 3.12' }));
  await waitFor(() => {
    expect(useOnboarding.getState().placedUnit).toBe('3.12');
  });
  const units = appended().flatMap((e) => (e.type === 'unit_tested_out' ? [e.unit] : []));
  expect(units).toEqual(PATH_UNITS.slice(0, PATH_UNITS.indexOf('3.12')));
  expect(units).not.toContain('3.12');
  // The partition that would otherwise go unasserted: the unit the unmoved
  // placement WOULD have tested out is not in the list.
  expect(units).not.toContain('4.1');
});

/* ------------------------------------------------------------- rules check */

test('"I know the rules" runs five questions and places at 2.1 on a pass', async () => {
  useOnboarding.getState().setLevel('know_rules');
  mount();
  expect(await screen.findByRole('heading', { name: 'A quick check on the rules' })).toBeInTheDocument();
  expect(screen.getByText('5 questions')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /^start$/i }));
  expect(await screen.findByRole('heading', { name: 'Rules check' })).toBeInTheDocument();
  await answerRound(5, true);
  expect(await screen.findByRole('heading', { name: 'Where you start' })).toBeInTheDocument();
  expect(screen.getByText('2.1 Real Chess')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(/passed the rules check/);
});

test('the rules check places at 1.3 when it is not passed', async () => {
  useOnboarding.getState().setLevel('know_rules');
  mount();
  await userEvent.click(await screen.findByRole('button', { name: /^start$/i }));
  await screen.findByRole('button', { name: RIGHT });
  await answerRound(5, false);
  expect(await screen.findByRole('heading', { name: 'Where you start' })).toBeInTheDocument();
  expect(screen.getByText('1.3 Check, mate and draws')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Start at 1.3' })).toBeInTheDocument();
});

test('the rules check is one round, not four', async () => {
  useOnboarding.getState().setLevel('know_rules');
  mount();
  await userEvent.click(await screen.findByRole('button', { name: /^start$/i }));
  await screen.findByRole('button', { name: RIGHT });
  expect(screen.getByLabelText('Challenge progress')).toHaveTextContent('1 of 5');
  await answerRound(5, true);
  // Straight to the result: the ladder's four rounds would have put another
  // question on screen here.
  expect(await screen.findByRole('heading', { name: 'Where you start' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: RIGHT })).toBeNull();
});

/* ------------------------------------------------------------ re-entry */

test('a learner who has already been placed is not asked to place again', async () => {
  useOnboarding.getState().markPlaced('2.3');
  mount();
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
  });
  expect(appended()).toEqual([]);
});

test('the ladder really probes different units, so the run is adaptive and not a fixed list', async () => {
  // Cleared rounds walk up the ladder; missed rounds walk down. Both are driven
  // through the real `nextRung`, so this is the route honouring the adaptive
  // rule rather than the rule being tested again.
  mount();
  await userEvent.click(await screen.findByRole('button', { name: /^start$/i }));
  const up: string[] = [];
  for (let round = 0; round < 4; round++) {
    const prompt = await screen.findByText(/question 1$/);
    up.push((prompt.textContent ?? '').split(' ')[0] ?? '');
    await answerRound(RUNG_SIZE, true);
  }
  expect(up).toEqual(['2.3', '3.7', '3.11', '3.1']);
  expect(new Set(up).size).toBe(4);
  // ...and they are the ladder's own units, not something the route invented.
  for (const u of up) expect(PLACEMENT_LADDER.map((r) => r.unit)).toContain(u);
});

test('the tested-out sentence agrees in number when exactly one unit qualifies', async () => {
  await runLadder(true);
  // Step back to 1.2, where exactly one unit — 1.1 — is tested out.
  for (const to of PATH_UNITS.slice(1, PATH_UNITS.indexOf('4.1')).reverse()) {
    await userEvent.click(screen.getByRole('button', { name: `Start earlier, at ${to}` }));
  }
  expect(screen.getByRole('button', { name: 'Start at 1.2' })).toBeInTheDocument();
  expect(screen.getByText(/1\.1 The board and the pieces is marked tested out and counts as passed/)).toBeInTheDocument();
  // The plural form is the one that reads wrong here, so assert it is absent —
  // with the positive control that the plural DOES appear two units up.
  expect(screen.queryByText(/are marked tested out/)).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Start earlier, at 1.1' }));
  expect(screen.getByText('Nothing tested out')).toBeInTheDocument();
});

test('the plural form is used when more than one unit is tested out', async () => {
  await runLadder(true);
  expect(screen.getByText(/1\.1 The board and the pieces to 3\.12 Story games are marked tested out and count as passed/)).toBeInTheDocument();
  expect(screen.queryByText(/counts as passed/)).toBeNull();
});
