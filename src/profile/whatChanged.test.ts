import { expect, test } from 'vitest';
import type { Theme } from '@/review/errorLog';
import { measureGame } from './metrics';
import { WINDOW, whatChanged } from './whatChanged';
import { aGame } from './testGames';

/** `n` games, newest first, each with `per` occurrences of `theme`. */
function run(n: number, theme: Theme | null, per: number) {
  return Array.from({ length: n }, () =>
    measureGame(
      aGame({
        moves: Array.from({ length: Math.max(1, per) }, () => ({ label: 'Mistake' as const, drop: 20 })),
        errors: theme === null ? [] : Array.from({ length: per }, (_, i) => ({ theme, ply: i })),
      }),
    ),
  );
}

test('below forty games there is no comparison, and the shortfall is stated', () => {
  const c = whatChanged(run(30, 'hung_piece', 1));
  expect(c.available).toBe(false);
  expect(c.sentences.join(' ')).toContain('10 more games');
  expect(c.recentGames).toBe(WINDOW);
  expect(c.previousGames).toBe(10);
});

test('the boundary is both windows full: thirty-nine games is not enough, forty is', () => {
  expect(whatChanged(run(WINDOW * 2 - 1, 'hung_piece', 1)).available).toBe(false);
  expect(whatChanged(run(WINDOW * 2, 'hung_piece', 1)).available).toBe(true);
});

test('a learner with no games is told what the section will do', () => {
  const c = whatChanged([]);
  expect(c.available).toBe(false);
  expect(c.sentences[0]).toContain('40 analysed games');
  expect(c.sentences[0]).not.toContain('NaN');
});

test('a theme that stopped is reported as having stopped', () => {
  // F-SW-7's own example sentence shape: "you have stopped leaving the back rank
  // open". Recent window clean, previous window not.
  const games = [...run(WINDOW, null, 0), ...run(WINDOW, 'hung_piece', 2)];
  const c = whatChanged(games);
  expect(c.available).toBe(true);
  expect(c.sentences.join(' ')).toContain('You have stopped leaving pieces free to take.');
});

test('a theme that got worse is reported as up, with both rates', () => {
  const games = [...run(WINDOW, 'missed_mate', 2), ...run(WINDOW, null, 0)];
  const joined = whatChanged(games).sentences.join(' ');
  expect(joined).toContain('is up, from 0.0 to 2.0 a game');
  expect(joined).toContain('Missing mate in one');
});

test('a theme that improved without disappearing is reported as down', () => {
  const games = [...run(WINDOW, 'hung_piece', 1), ...run(WINDOW, 'hung_piece', 3)];
  const joined = whatChanged(games).sentences.join(' ');
  expect(joined).toContain('is down, from 3.0 to 1.0 a game');
  expect(joined).not.toContain('stopped');
});

test('a theme that is unchanged and still happening is named as still a problem', () => {
  // "forks are still the main problem" in F-SW-7's example.
  const games = [...run(WINDOW, 'ignored_threat', 2), ...run(WINDOW, 'ignored_threat', 2)];
  const joined = whatChanged(games).sentences.join(' ');
  expect(joined).toContain('has not changed, at about 2.0 a game');
});

test('a theme that never happened in either window produces no sentence', () => {
  // "You still never miss a mate in one" reads as a warning that you might.
  const games = [...run(WINDOW, 'hung_piece', 1), ...run(WINDOW, 'hung_piece', 1)];
  const joined = whatChanged(games).sentences.join(' ');
  expect(joined).not.toContain('mate in one');
  // Positive control: the theme that DID happen is named, so the absence above is
  // about the silent theme and not about a function that says nothing at all.
  expect(joined).toContain('Leaving pieces free to take');
});

test('the costliest current theme is named first', () => {
  const recent = [
    ...Array.from({ length: WINDOW }, () =>
      measureGame(
        aGame({
          moves: [{ label: 'Mistake', drop: 20 }, { label: 'Mistake', drop: 20 }, { label: 'Mistake', drop: 20 }],
          errors: [{ theme: 'ignored_threat', ply: 0 }, { theme: 'ignored_threat', ply: 1 }, { theme: 'hung_piece', ply: 2 }],
        }),
      ),
    ),
  ];
  const c = whatChanged([...recent, ...run(WINDOW, null, 0)]);
  const first = c.sentences[0] ?? '';
  expect(first.toLowerCase()).toContain('ignoring');
});

test('accuracy change is reported per phase, and only when both windows have it', () => {
  const withPhase = (acc: number, phase: 'opening' | 'endgame') =>
    Array.from({ length: WINDOW }, () => measureGame(aGame({ moves: [{ accuracy: acc, phase }] })));
  // Both windows have an opening accuracy, so it is compared.
  const both = whatChanged([...withPhase(80, 'opening'), ...withPhase(60, 'opening')]);
  expect(both.sentences.join(' ')).toContain('opening accuracy is up, from 60% to 80%');
  // Only the recent window reached an endgame, so there is nothing to compare and
  // the single number must not be reported as an improvement.
  const onlyRecent = whatChanged([...withPhase(80, 'endgame'), ...withPhase(60, 'opening')]);
  const joined = onlyRecent.sentences.join(' ');
  expect(joined).not.toContain('endgame accuracy');
});

test('a genuinely unchanged pair of windows says so rather than nothing', () => {
  const c = whatChanged([...run(WINDOW, null, 0), ...run(WINDOW, null, 0)]);
  expect(c.available).toBe(true);
  expect(c.sentences).toHaveLength(1);
  expect(c.sentences[0]).toContain('Nothing has changed much');
});

test('only the first forty games are read, so a long history does not skew a window', () => {
  // The windows are the last twenty and the twenty before. Games forty-one and
  // onward must not enter either — a slice that read to the end would dilute the
  // previous window with a learner's whole back catalogue.
  const games = [...run(WINDOW, null, 0), ...run(WINDOW, 'hung_piece', 2), ...run(100, 'missed_mate', 5)];
  const joined = whatChanged(games).sentences.join(' ');
  expect(joined).toContain('You have stopped leaving pieces free to take.');
  expect(joined).not.toContain('mate in one');
});

test('every sentence is a sentence, with no placeholder leaking through', () => {
  const games = [...run(WINDOW, 'unclassified', 3), ...run(WINDOW, 'hung_piece', 1)];
  const c = whatChanged(games);
  expect(c.sentences.length).toBeGreaterThan(0);
  for (const s of c.sentences) {
    expect(s).toMatch(/\.$/);
    expect(s).not.toMatch(/undefined|NaN|Infinity|\[object/);
  }
});
