import { BotService } from './BotService';
import { START_FEN } from '@/rules';
import rosa from '@content/personas/rosa.json';

const analysis = (moves: string[]) => ({
  depth: 8,
  lines: moves.map((move) => ({ move, pv: [move], score: { cp: 20 }, depth: 8 })),
});

test('plays the opening preference while it is legal', async () => {
  const engine = { analyse: vi.fn() };
  const bot = new BotService(rosa, engine as never, () => 0.5);
  expect(await bot.chooseMove(START_FEN)).toBe('e2e4');
  expect(engine.analyse).not.toHaveBeenCalled();
});

test('asks the engine for multipv 6 at depth 8 once out of book', async () => {
  const engine = { analyse: vi.fn().mockResolvedValue(analysis(['d2d3'])) };
  const bot = new BotService(rosa, engine as never, () => 0.5);
  const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'; // 1.e4 e5
  expect(await bot.chooseMove(fen)).toBe('g1f3');
  const fen2 = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
  expect(await bot.chooseMove(fen2)).toBe('f1c4');
  expect(engine.analyse).not.toHaveBeenCalled();
  const fen3 = 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'; // book exhausted
  expect(await bot.chooseMove(fen3)).toBe('d2d3');
  expect(engine.analyse).toHaveBeenCalledWith({ fen: fen3, depth: 8, multiPv: 6 });
});

test('the book is matched by legality, so a transposition still finds its move', async () => {
  const engine = { analyse: vi.fn().mockResolvedValue(analysis(['d2d3'])) };
  const bot = new BotService(rosa, engine as never, () => 0.5);
  // 1.Nf3 e5 2.e4 — the bot has played Nf3 first, so indexing the book by move number would
  // ask for f1c4 (illegal here). Matching by legality plays the remaining book move instead.
  const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3';
  expect(await bot.chooseMove(fen)).toBe('f1c4');
  expect(engine.analyse).not.toHaveBeenCalled();
});

test('falls through to the engine when no book move is legal', async () => {
  const engine = { analyse: vi.fn().mockResolvedValue(analysis(['d7c5'])) };
  const bot = new BotService(rosa, engine as never, () => 0.5);
  // Black to move, still in the opening, but none of e7e5 / b8c6 / f8c5 is legal here.
  const fen = 'r1bqk2r/pppnbppp/5n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 b kq - 0 6';
  expect(await bot.chooseMove(fen)).toBe('d7c5');
  expect(engine.analyse).toHaveBeenCalledWith({ fen, depth: 8, multiPv: 6 });
});

test('never revives the book after the opening', async () => {
  const engine = { analyse: vi.fn().mockResolvedValue(analysis(['g1f3'])) };
  const bot = new BotService(rosa, engine as never, () => 0.5);
  // g1f3 is legal again here, but the game is well past the opening.
  const fen = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP4/PPP2PPP/R1BQK1NR w KQkq - 0 12';
  expect(await bot.chooseMove(fen)).toBe('g1f3');
  expect(engine.analyse).toHaveBeenCalledWith({ fen, depth: 8, multiPv: 6 });
});

test('classifies move kinds from the position so style weights apply', async () => {
  // Black to move, out of book: Nxe5 is a plain capture, Qh4 is a quiet move.
  const fen = 'r1bqkbnr/pppp1ppp/2n5/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 4';
  const engine = { analyse: vi.fn().mockResolvedValue(analysis(['c6e5', 'd8h4'])) };
  // Weights are capture 1.2 and quiet 1.0; the capture bucket ends at 1.2/2.2 ≈ 0.545.
  const pick = async (r: number) => new BotService(rosa, engine as never, () => r).chooseMove(fen);
  expect(await pick(0.9)).toBe('d8h4');
  expect(await pick(0.1)).toBe('c6e5');
});
