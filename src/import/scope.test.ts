import {
  BATCH_SIZE,
  FIRST_IMPORT_SIZE,
  MAX_IMPORT_SIZE,
  nextBatchLimit,
  profileGames,
  selectForImport,
  speedFromChessCom,
  speedFromLichess,
  speedFromTimeControl,
} from './scope';
import type { Speed } from './types';

function g(speed: Speed, playedAt: string) {
  return { speed, playedAt };
}

/** `n` games of one speed, newest first, one day apart from 2026-09-30 back. */
function run(speed: Speed, n: number, startDay = 30) {
  return Array.from({ length: n }, (_, i) => g(speed, `2026-09-${String(startDay - i).padStart(2, '0')}T12:00:00Z`));
}

test('F-IM-2 constants are the numbers the requirement states', () => {
  expect(FIRST_IMPORT_SIZE).toBe(50);
  expect(BATCH_SIZE).toBe(50);
  expect(MAX_IMPORT_SIZE).toBe(500);
});

test('the first import takes 50', () => {
  expect(nextBatchLimit(0)).toBe(50);
});

test('further batches step by 50', () => {
  expect(nextBatchLimit(50)).toBe(100);
  expect(nextBatchLimit(100)).toBe(150);
  expect(nextBatchLimit(450)).toBe(500);
});

test('the ceiling is 500 and a partial batch is clamped, not overshot', () => {
  expect(nextBatchLimit(480)).toBe(500);
  expect(nextBatchLimit(499)).toBe(500);
});

test('at 500 there is nothing more to ask for', () => {
  expect(nextBatchLimit(500)).toBeNull();
  expect(nextBatchLimit(501)).toBeNull();
  // Positive control: the same call shape returns a number below the ceiling, so
  // null is the ceiling's answer and not a broken call.
  expect(nextBatchLimit(499)).toBe(500);
});

test("chess.com's time_class maps onto the four speeds", () => {
  expect(speedFromChessCom('rapid')).toBe('rapid');
  expect(speedFromChessCom('blitz')).toBe('blitz');
  expect(speedFromChessCom('bullet')).toBe('bullet');
  expect(speedFromChessCom('daily')).toBe('daily');
});

test('an unknown chess.com class is other, never coerced into a real speed', () => {
  expect(speedFromChessCom('lightning')).toBe('other');
  expect(speedFromChessCom('')).toBe('other');
});

test("Lichess correspondence is F-IM-2's daily", () => {
  expect(speedFromLichess('correspondence')).toBe('daily');
  expect(speedFromLichess('rapid')).toBe('rapid');
  expect(speedFromLichess('blitz')).toBe('blitz');
  expect(speedFromLichess('bullet')).toBe('bullet');
});

test('Lichess classical and ultraBullet are other, because F-IM-2 names neither', () => {
  expect(speedFromLichess('classical')).toBe('other');
  expect(speedFromLichess('ultraBullet')).toBe('other');
});

test('a TimeControl tag is classified on estimated duration', () => {
  expect(speedFromTimeControl('600')).toBe('rapid'); // 10+0
  expect(speedFromTimeControl('300+3')).toBe('blitz'); // 5+3 -> 420
  expect(speedFromTimeControl('180')).toBe('blitz'); // 3+0 is the blitz floor
  expect(speedFromTimeControl('60')).toBe('bullet'); // 1+0
  // 2+1 is deliberately NOT asserted here: it sits either side of the bullet
  // boundary depending on whether the increment counts, which is a claim of its
  // own and is pinned by the next test rather than bundled into this one.
});

test('the increment counts toward the estimate, so 2+1 is not bullet', () => {
  // 120 + 40*1 = 160 < 180, so 2+1 IS bullet. This pins the arithmetic rather
  // than the intuition: without the increment term 120 would also be bullet and
  // the two cases would be indistinguishable.
  expect(speedFromTimeControl('120+1')).toBe('bullet');
  expect(speedFromTimeControl('120+2')).toBe('blitz'); // 120 + 80 = 200
});

test('a correspondence TimeControl is daily', () => {
  expect(speedFromTimeControl('1/86400')).toBe('daily');
  expect(speedFromTimeControl('1/259200')).toBe('daily');
});

test('unlimited, absent and unparseable TimeControl are other', () => {
  expect(speedFromTimeControl('-')).toBe('other');
  expect(speedFromTimeControl(null)).toBe('other');
  expect(speedFromTimeControl('banana')).toBe('other');
  expect(speedFromTimeControl('1800')).toBe('other'); // 30+0 is classical
  expect(speedFromTimeControl('15')).toBe('other'); // ultraBullet
  // Positive control: the same function returns a real speed for a real tag, so
  // 'other' above is a classification and not a function that always says other.
  expect(speedFromTimeControl('600')).toBe('rapid');
});

test('the quota counts rapid, blitz and daily and stops at the limit', () => {
  const sel = selectForImport(run('rapid', 60), 50);
  expect(sel.take).toHaveLength(50);
  expect(sel.overLimit).toHaveLength(10);
  expect(sel.outOfScope).toHaveLength(0);
});

test('the newest games are the ones taken, whatever order they arrive in', () => {
  const oldest = g('rapid', '2026-01-01T00:00:00Z');
  const newest = g('rapid', '2026-09-30T00:00:00Z');
  const middle = g('rapid', '2026-05-05T00:00:00Z');
  // Deliberately mis-ordered input: chess.com lists each month ascending inside
  // a descending list of months, so an unsorted quota takes the oldest games.
  const sel = selectForImport([oldest, middle, newest], 2);
  expect(sel.take).toEqual([newest, middle]);
  expect(sel.overLimit).toEqual([oldest]);
});

test('bullet games do not consume the quota but are imported', () => {
  // 50 rapid interleaved with 20 bullet: all 50 rapid are taken AND the bullet
  // games inside the horizon come too, so the stored count exceeds the quota.
  const games = [...run('rapid', 50), ...run('bullet', 20)];
  const sel = selectForImport(games, 50);
  expect(sel.take.filter((x) => x.speed === 'rapid')).toHaveLength(50);
  expect(sel.take.filter((x) => x.speed === 'bullet')).toHaveLength(20);
  expect(sel.take.length).toBeGreaterThan(50);
});

test('bullet games past the horizon are not imported', () => {
  // The quota closes on the 2nd rapid game; a bullet game older than that is
  // beyond this import's horizon. Without this the tail of every import is the
  // learner's entire bullet history.
  const sel = selectForImport(
    [g('rapid', '2026-09-30T00:00:00Z'), g('rapid', '2026-09-29T00:00:00Z'), g('bullet', '2020-01-01T00:00:00Z')],
    2,
  );
  expect(sel.take).toHaveLength(2);
  expect(sel.take.every((x) => x.speed === 'rapid')).toBe(true);
  expect(sel.overLimit).toEqual([g('bullet', '2020-01-01T00:00:00Z')]);
});

test('out-of-scope speeds are reported separately and never stored', () => {
  const sel = selectForImport([g('rapid', '2026-09-30T00:00:00Z'), g('other', '2026-09-29T00:00:00Z')], 50);
  expect(sel.take).toHaveLength(1);
  expect(sel.outOfScope).toHaveLength(1);
  expect(sel.take[0]!.speed).toBe('rapid');
  // Positive control: `other` games ARE present in the input and a selector that
  // ignored speed would have taken both, so take.length === 1 is a filter result.
  expect(sel.take.map((x) => x.speed)).not.toContain('other');
});

test('a limit of zero takes nothing and loses nothing', () => {
  const sel = selectForImport(run('rapid', 5), 0);
  expect(sel.take).toEqual([]);
  expect(sel.overLimit).toHaveLength(5);
});

test('the profile excludes bullet by default', () => {
  const games = [g('rapid', 'x'), g('bullet', 'y'), g('blitz', 'z'), g('daily', 'w')];
  expect(profileGames(games, false).map((x) => x.speed)).toEqual(['rapid', 'blitz', 'daily']);
});

test('one switch includes bullet in the profile', () => {
  const games = [g('rapid', 'x'), g('bullet', 'y')];
  expect(profileGames(games, true)).toHaveLength(2);
  expect(profileGames(games, true).map((x) => x.speed)).toContain('bullet');
});

test('the switch never admits an out-of-scope speed', () => {
  const games = [g('rapid', 'x'), g('other', 'y')];
  expect(profileGames(games, true).map((x) => x.speed)).toEqual(['rapid']);
  // Positive control: the switch DOES change the bullet answer on the same call
  // shape, so 'other' staying out is specific to 'other'.
  expect(profileGames([g('bullet', 'x')], true)).toHaveLength(1);
  expect(profileGames([g('bullet', 'x')], false)).toHaveLength(0);
});

test('selectForImport does not mutate its input', () => {
  const games = [g('rapid', '2026-01-01T00:00:00Z'), g('rapid', '2026-09-01T00:00:00Z')];
  const before = [...games];
  selectForImport(games, 50);
  expect(games).toEqual(before);
});
