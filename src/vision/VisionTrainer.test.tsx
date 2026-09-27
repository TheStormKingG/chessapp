import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VisionTrainer } from './VisionTrainer';
import { useVision } from './bests';
import { MODE_TITLE, ROUND_MS, VISION_MODES } from './types';

/**
 * The screen, tested without waiting 30 seconds for a round to end.
 *
 * The clock is moved with `vi.setSystemTime`, which is legitimate HERE and would
 * not have been in session.test.ts: this component is the one place in the feature
 * that reads a real clock, so faking it is faking the component's input rather
 * than substituting for the logic's arithmetic. The logic is tested against plain
 * numbers next door.
 */

async function start(mode: (typeof VISION_MODES)[number]) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const view = render(<VisionTrainer />);
  await user.click(screen.getByRole('button', { name: new RegExp(MODE_TITLE[mode]) }));
  // The board is rendered by react-chessboard, which builds its squares after
  // mount; nothing can be clicked until they exist.
  await waitFor(() => {
    expect(view.container.querySelector('[data-square]')).not.toBeNull();
  });
  return { user, view };
}

/**
 * Taps a square on the board.
 *
 * The board is a `role="application"` grid of `[data-square]` elements, not a set
 * of buttons — src/board/Board.test.tsx addresses it the same way. So the tap goes
 * to the square the learner would touch, through the board's own select handler,
 * rather than to a control invented for the test.
 */
async function tapSquare(user: ReturnType<typeof userEvent.setup>, root: HTMLElement, square: string) {
  const cell = root.querySelector<HTMLElement>(`[data-square="${square}"]`);
  expect(cell, `no square ${square} on the board`).not.toBeNull();
  await user.click(cell!);
}

/** The square the `find-square` prompt is asking for. */
function askedSquare(): string {
  const found = /Where is ([a-h][1-8])\?/.exec(screen.getByTestId('prompt').textContent ?? '')?.[1];
  expect(found, 'the prompt did not name a square').toBeDefined();
  return found!;
}

/**
 * Moves the wall clock on by `ms` and lets the component's countdown redraw once.
 *
 * It JUMPS the clock and then fires a single interval callback, rather than
 * advancing 30 seconds a tick at a time.
 *
 * The difference is not cosmetic. `Round` redraws on a 250 ms interval, so
 * advancing through 30 s tick by tick runs ~122 interval callbacks, each
 * re-rendering a 64-square board — and the test then failed under load with
 * "Test timed out in 5000ms" while passing in isolation, which is the signature
 * of a budget crossed rather than a defect. Jumping does one render instead of a
 * hundred and twenty-two, and asserts the same thing: the component recomputes
 * whether the round is over from the clock at every render, never from the number
 * of ticks it has seen, so no intermediate tick is load-bearing. (That is also
 * what makes a backgrounded or throttled tab safe — see the note in
 * VisionTrainer.tsx.)
 *
 * One tick's worth of extra time passes on top of `ms`, which is why the
 * countdown assertions below allow a second either way.
 */
async function advance(ms: number) {
  vi.setSystemTime(Date.now() + ms);
  await vi.advanceTimersByTimeAsync(TICK_MS + 1);
}

/** The component's redraw interval. Kept in step with VisionTrainer.tsx. */
const TICK_MS = 250;

describe('the vision trainer (F-PR-2)', () => {
  beforeEach(() => {
    useVision.getState().reset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-09-27T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('offers exactly the three modes F-PR-2 names', () => {
    render(<VisionTrainer />);
    for (const mode of VISION_MODES) {
      expect(screen.getByRole('button', { name: new RegExp(MODE_TITLE[mode]) })).toBeInTheDocument();
    }
    expect(VISION_MODES).toHaveLength(3);
    expect([...VISION_MODES]).toEqual(['find-square', 'find-destination', 'count-attackers']);
  });

  it('offers a board orientation choice, and remembers it', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<VisionTrainer />);
    const black = screen.getByRole('button', { name: /Black at the bottom/ });
    expect(black).toHaveAttribute('aria-pressed', 'false');
    await user.click(black);
    expect(black).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /White at the bottom/ })).toHaveAttribute('aria-pressed', 'false');
    // Remembered in the store, so the next round starts the way the last ended.
    expect(useVision.getState().orientation).toBe('b');
  });

  it('starts a round at 30 seconds and counts down', async () => {
    /*
     * The BOUNDARY arithmetic — 30 s exactly, over at ROUND_MS and not a
     * millisecond before — is session.test.ts's job, against plain numbers with no
     * timers at all. What this test owns is that the screen shows a countdown and
     * that it falls as time passes.
     *
     * So the later readings are asserted within a second of expected rather than
     * exactly. `shouldAdvanceTime` lets real time creep alongside the fake clock
     * (userEvent needs it to settle its own waits), so 25,000 ms of advancing
     * leaves slightly more than 25 s elapsed. Demanding "25s" here would be
     * asserting the harness's jitter, and it would fail on a slow machine having
     * found nothing.
     */
    await start('find-square');
    // No time has passed yet, so this one IS exact.
    expect(screen.getByTestId('clock')).toHaveTextContent('30s');

    const seconds = (): number => Number(/(\d+)s/.exec(screen.getByTestId('clock').textContent ?? '')![1]);

    /*
     * The redraw is asynchronous — the interval sets state and React flushes on
     * its own schedule — so each reading is awaited rather than read straight
     * after advancing the clock. Reading synchronously got the PREVIOUS value and
     * failed on the first assertion.
     */
    await advance(5_000);
    await waitFor(() => {
      expect(seconds()).toBeLessThanOrEqual(25);
    });
    const atFive = seconds();
    expect(atFive).toBeGreaterThanOrEqual(24);

    await advance(20_000);
    await waitFor(() => {
      expect(seconds()).toBeLessThanOrEqual(5);
    });
    const atTwentyFive = seconds();
    expect(atTwentyFive).toBeGreaterThanOrEqual(4);
    // And it went DOWN, which is the claim a fixed pair of numbers was standing in for.
    expect(atTwentyFive).toBeLessThan(atFive);
  });

  it('asks a question and scores a right answer', async () => {
    const { user, view } = await start('find-square');
    // The prompt names the square, so the test reads the question rather than
    // guessing it — the same route the learner takes.
    const square = askedSquare();
    expect(screen.getByTestId('score')).toHaveTextContent('0/0');

    await tapSquare(user, view.container, square);
    await waitFor(() => {
      expect(screen.getByTestId('score')).toHaveTextContent('1/1');
    });
    expect(screen.getByTestId('verdict')).toHaveTextContent('Right.');
  });

  it('scores a wrong square as asked but not right', async () => {
    const { user, view } = await start('find-square');
    const asked = askedSquare();
    const wrong = asked === 'a1' ? 'h8' : 'a1';
    await tapSquare(user, view.container, wrong);
    await waitFor(() => {
      expect(screen.getByTestId('score')).toHaveTextContent('0/1');
    });
    expect(screen.getByTestId('verdict')).toHaveTextContent(/Not quite/);
    // And the reason names the square that was asked for.
    expect(screen.getByTestId('verdict')).toHaveTextContent(asked);
  });

  it('tells a learner which men they missed when a count is wrong', async () => {
    const { user } = await start('count-attackers');
    expect(screen.getByTestId('prompt')).toHaveTextContent(/How many (white|black) men attack [a-h][1-8]\?/);
    // Every count button is offered, so one of them is wrong for any question.
    const buttons = screen.getAllByRole('button', { name: /^[0-9]$/ });
    expect(buttons.length).toBeGreaterThan(1);
    // 0 is never the answer (questions.ts filters to 1..6), so it is always wrong.
    await user.click(screen.getByRole('button', { name: '0' }));
    await waitFor(() => {
      expect(screen.getByTestId('verdict')).toHaveTextContent(/Not quite/);
    });
    // The squares, not just a number: that is the teaching content of this mode.
    expect(screen.getByTestId('verdict')).toHaveTextContent(/[a-h][1-8]/);
    expect(screen.getByTestId('score')).toHaveTextContent('0/1');
  });

  it('ends the round at 30 seconds and shows the score', async () => {
    await start('find-square');
    await advance(ROUND_MS + TICK_MARGIN);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Time' })).toBeInTheDocument();
    });
    expect(screen.getByTestId('final-score')).toHaveTextContent('0 right out of 0');
  });

  it('banks a new personal best for that mode alone', async () => {
    const { user, view } = await start('find-square');
    await tapSquare(user, view.container, askedSquare());
    await waitFor(() => {
      expect(screen.getByTestId('score')).toHaveTextContent('1/1');
    });

    await advance(ROUND_MS + TICK_MARGIN);
    await waitFor(() => {
      expect(screen.getByTestId('best-line')).toBeInTheDocument();
    });
    expect(screen.getByTestId('best-line')).toHaveTextContent(/new best/i);
    expect(useVision.getState().bests['find-square']).toBe(1);
    // A best per MODE: the other two are untouched.
    expect(useVision.getState().bests['count-attackers']).toBe(0);
    expect(useVision.getState().bests['find-destination']).toBe(0);
  });

  it('does not call a worse round a new best', async () => {
    useVision.getState().record('find-square', 20);
    await start('find-square');
    await advance(ROUND_MS + TICK_MARGIN);
    await waitFor(() => {
      expect(screen.getByTestId('best-line')).toBeInTheDocument();
    });
    expect(screen.getByTestId('best-line')).toHaveTextContent('Your best is 20.');
    expect(screen.getByTestId('best-line')).not.toHaveTextContent(/new best/i);
    expect(useVision.getState().bests['find-square']).toBe(20);
  });

  it('shows the best on the setup screen once there is one', async () => {
    useVision.getState().record('count-attackers', 7);
    render(<VisionTrainer />);
    expect(screen.getByTestId('best-count-attackers')).toHaveTextContent('Your best: 7');
    // And says so plainly for a mode never played, rather than showing a zero.
    expect(screen.getByTestId('best-find-square')).toHaveTextContent('Not played yet');
  });

  it('goes again on the same mode from the result screen', async () => {
    const { user } = await start('find-square');
    await advance(ROUND_MS + TICK_MARGIN);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Go again' })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: 'Go again' }));
    await waitFor(() => {
      expect(screen.getByTestId('clock')).toHaveTextContent('30s');
    });
    expect(screen.getByRole('heading', { name: MODE_TITLE['find-square'] })).toBeInTheDocument();
  });

  it('goes back to the mode list from the result screen', async () => {
    const { user } = await start('find-square');
    await advance(ROUND_MS + TICK_MARGIN);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Choose another mode' })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: 'Choose another mode' }));
    expect(screen.getByRole('heading', { name: 'Vision trainer' })).toBeInTheDocument();
  });

  it('offers count buttons only for the counting mode', async () => {
    await start('find-square');
    // The absence assertion. Its positive control is the separate block below,
    // which runs the same query against the mode that DOES offer the buttons —
    // in its own test because two rounds cannot share one render.
    expect(screen.queryAllByRole('button', { name: /^[0-9]$/ })).toHaveLength(0);
  });
});

describe('the counting mode offers its buttons', () => {
  beforeEach(() => {
    useVision.getState().reset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-09-27T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is the positive control for the absence asserted above', async () => {
    await start('count-attackers');
    expect(screen.getAllByRole('button', { name: /^[0-9]$/ }).length).toBeGreaterThan(1);
  });
});

/**
 * A little past the boundary, so the component's 250 ms interval has fired at
 * least once after the round's own end. The round is over AT `ROUND_MS`
 * (session.test.ts pins that); this margin is about the redraw, not the rule.
 */
const TICK_MARGIN = 400;
