import { parseInfo, parseBestMove } from './uci';

test('parses a multipv info line with cp', () => {
  expect(parseInfo('info depth 12 seldepth 18 multipv 2 score cp -35 nodes 1 nps 1 time 1 pv e7e5 g1f3 b8c6')).toEqual({
    depth: 12, multipv: 2, score: { cp: -35 }, pv: ['e7e5', 'g1f3', 'b8c6'],
  });
});

test('parses a mate score', () => {
  expect(parseInfo('info depth 5 multipv 1 score mate 2 pv h5f7')).toEqual({ depth: 5, multipv: 1, score: { mate: 2 }, pv: ['h5f7'] });
});

test('ignores lines without pv', () => {
  expect(parseInfo('info depth 3 currmove e2e4 currmovenumber 1')).toBeNull();
});

test('parses bestmove', () => {
  expect(parseBestMove('bestmove e2e4 ponder e7e5')).toBe('e2e4');
  expect(parseBestMove('bestmove (none)')).toBeNull();
});
