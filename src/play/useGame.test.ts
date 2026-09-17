import { act, renderHook, waitFor } from '@testing-library/react';
import { useGame } from './useGame';

const analytics = vi.hoisted(() => ({ track: vi.fn(), reportError: vi.fn() }));
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
  expect(analytics.reportError).toHaveBeenCalledWith(expect.any(Error), { where: 'play-bot-move' });
});
