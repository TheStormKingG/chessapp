import { act, renderHook, waitFor } from '@testing-library/react';
import { useGame } from './useGame';

const analytics = vi.hoisted(() => ({ track: vi.fn(), reportError: vi.fn(), reportEngineFailure: vi.fn() }));
vi.mock('@/analytics', () => analytics);

const bot = vi.hoisted(() => ({ chooseMove: vi.fn() }));
vi.mock('@/bot', () => ({
  BotService: class {
    chooseMove = bot.chooseMove;
  },
}));

const engine = vi.hoisted(() => ({ analyse: vi.fn(), bestMove: vi.fn(), pause: vi.fn(), resume: vi.fn() }));
vi.mock('@/engine', () => ({ getEngine: () => engine }));

beforeEach(() => {
  analytics.track.mockReset();
  analytics.reportError.mockReset();
  analytics.reportEngineFailure.mockReset();
  bot.chooseMove.mockReset();
  engine.bestMove.mockReset();
});

test('game_started carries the persona, clock and coach mode, and nothing personal', async () => {
  bot.chooseMove.mockResolvedValue('e2e4');
  renderHook(() => useGame({ learner: 'w', timeControl: '10+0', coach: false }));

  await waitFor(() => {
    expect(analytics.track).toHaveBeenCalledWith('game_started', {
      persona: 'rosa',
      color: 'w',
      timeControl: '10+0',
      coach: false,
    });
  });
});

test('game_finished carries the result and the crowns', async () => {
  bot.chooseMove.mockResolvedValue('e2e4');
  const { result } = renderHook(() => useGame({ learner: 'w', timeControl: 'untimed', coach: true }));

  act(() => {
    result.current.giveUp();
  });

  await waitFor(() => {
    expect(analytics.track).toHaveBeenCalledWith(
      'game_finished',
      expect.objectContaining({ persona: 'rosa', timeControl: 'untimed', coach: true, result: 'loss', crowns: 3 }),
    );
  });
  const payload = analytics.track.mock.calls.find((c) => c[0] === 'game_finished')?.[1] as Record<string, unknown>;
  // No game id and no move list: the payload says how the game went, not which game it was.
  expect(payload).not.toHaveProperty('pgn');
  expect(payload).not.toHaveProperty('gameId');
});

test('an engine that cannot move the bot is reported, not swallowed', async () => {
  bot.chooseMove.mockRejectedValue(new Error('engine gone'));
  const { result } = renderHook(() => useGame({ learner: 'b', timeControl: 'untimed', coach: true }));

  await waitFor(() => {
    expect(result.current.engineDown).toBe(true);
  });
  // F-ER-1 requires the DEVICE CLASS on this report, so the site must go
  // through `reportEngineFailure`, which attaches it (see
  // analytics/deviceClass.test.ts). A bare `reportError` here would reach the
  // tracker with no way to tell a broken deploy from a 2 GB phone.
  expect(analytics.reportEngineFailure).toHaveBeenCalledWith(expect.any(Error), 'play-bot-move');
  // Absence claim, with its positive control one line above: the same mock
  // object registered the call that did happen, so an inert mock would have
  // failed that assertion first rather than making this one vacuous.
  expect(analytics.reportError).not.toHaveBeenCalled();
});

/*
 * The coach's line survived a take-back.
 *
 * `takeBack` clears the arrows, the highlights and the hint level -- everything
 * in `GameState` that described the position being withdrawn. The coach's line
 * described it too, but it lives in React state here rather than in `GameState`,
 * so it was the one thing left standing: a comment about a move the learner has
 * just taken back, sitting above a board that no longer contains it. F-CO-4 says
 * the coach never says a word it has not verified.
 */
test('taking a move back silences the comment about it', async () => {
  bot.chooseMove.mockResolvedValue('e7e5');
  engine.bestMove.mockResolvedValue('g1f3');
  const { result } = renderHook(() => useGame({ learner: 'w', timeControl: 'untimed', coach: true }));

  // A full move pair, so there is something to take back at all.
  act(() => {
    result.current.onLearnerMove('e2e4');
  });
  await waitFor(() => {
    expect(result.current.g.history.length).toBeGreaterThanOrEqual(3);
  });

  // Something for the coach to say. A hint is the deterministic route: the
  // template needs only the square it highlights.
  act(() => {
    result.current.hint();
  });
  await waitFor(() => {
    expect(result.current.coachText).not.toBeNull();
  });

  act(() => {
    result.current.undo();
  });
  expect(result.current.coachText).toBeNull();
});

test('the control: a take-back that cannot happen leaves the coach alone', async () => {
  // Without this, the fix above would pass just as well if `undo` simply always
  // silenced the coach -- including on a press that changes nothing. The button
  // is disabled in that state, so this is about the handler being honest rather
  // than about a reachable tap.
  bot.chooseMove.mockResolvedValue('e7e5');
  engine.bestMove.mockResolvedValue('e2e4');
  const { result } = renderHook(() => useGame({ learner: 'w', timeControl: 'untimed', coach: true }));

  act(() => {
    result.current.hint();
  });
  await waitFor(() => {
    expect(result.current.coachText).not.toBeNull();
  });
  const said = result.current.coachText;
  const before = result.current.g;

  act(() => {
    result.current.undo();
  });
  expect(result.current.g).toBe(before); // nothing was taken back
  expect(result.current.coachText).toBe(said); // so nothing was silenced
});

/*
 * The Threats button was a silent no-op whenever `captures` was empty, which
 * includes a forced mate against the learner and being in check. The cue is
 * covered in GameMachine.test.ts; this is the wiring -- that pressing the button
 * makes the coach speak at all.
 */
test('asking for threats makes the coach say something, even on a quiet board', async () => {
  bot.chooseMove.mockResolvedValue('e7e5');
  const { result } = renderHook(() => useGame({ learner: 'w', timeControl: 'untimed', coach: true }));
  await waitFor(() => {
    expect(result.current.g).toBeDefined();
  });
  expect(result.current.coachText).toBeNull(); // the control: silent before

  // The learner is White and moves first, so it IS their turn -- which the
  // assertion below depends on, since the button now refuses on the opponent's
  // move. Stated rather than assumed.
  expect(result.current.g.turn).toBe('w');

  act(() => {
    result.current.threats();
  });
  expect(result.current.coachText).not.toBeNull();
  // Specifically the quiet-board line, not the refusal one.
  expect(result.current.coachText).toContain('not the same as safe');
});
