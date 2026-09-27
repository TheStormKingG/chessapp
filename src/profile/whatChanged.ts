import { TYPICAL_THEMES, type Theme } from '@/review/errorLog';
import { plural } from '@/app/plural';
import { ratePerGame, totalsOf, type GameMetrics } from './metrics';
import { THEME_NAME } from './themes';
import type { WhatChanged } from './types';

/**
 * F-SW-7, "Change over time", verbatim:
 *
 * > "A 'what changed' section compares the last 20 games with the 20 before, in
 * > words ('you have stopped leaving the back rank open, forks are still the main
 * > problem'). It is also the content of the weekly summary email and push
 * > (F-EN-7)."
 *
 * ── THIS ONE NEEDS NO BAND DATA ──────────────────────────────────────────────
 *
 * Everything in it is the learner against themselves, twenty games ago. So it
 * ships complete — with one honest limit, which is a limit on the VOCABULARY
 * rather than on the comparison: F-SW-7's own example names "the back rank" and
 * "forks", and neither is among the four motifs src/tagger/tagger.ts implements.
 * The sentences are built from the four themes that exist. That is the same
 * pre-existing limit src/review/errorLog.ts already declares, not a new gap, and
 * the wording grows when the tagger does.
 *
 * ── WHY BOTH WINDOWS MUST BE FULL ────────────────────────────────────────────
 *
 * The requirement names two windows of twenty. With thirty games in total the
 * second window holds ten, and "you hang pieces less often than before" computed
 * from twenty games against ten is a comparison of two samples of different size
 * reported as though they were the same — the kind of claim F-SW-6 exists to
 * prevent. So below forty games there is no comparison, and the section says how
 * many more games it needs. A learner told "eight more games" can act on it.
 *
 * Rates rather than counts, even though the windows are the same size when a
 * comparison is made. Two reasons: the rate is the number the rest of the profile
 * speaks in, and a window is only exactly twenty because this module made it so —
 * a future F-EN-7 digest over a calendar week would hand over unequal windows and
 * a count-based comparison would then be silently wrong.
 */

/** F-SW-7's "the last 20 games" and "the 20 before". */
export const WINDOW = 20;

/** How much a per-game rate must move to be worth a sentence. */
const MATERIAL_CHANGE = 0.15;

/**
 * Builds the section from games ordered NEWEST FIRST.
 *
 * The order is the caller's contract and is not re-sorted here, for the reason
 * recency.ts gives: "recent" is keyed on `playedAt`, decided once in games.ts, so
 * an imported back-catalogue is compared by when it was played rather than by when
 * it happened to be imported. A module that re-sorted would be the second place
 * that decision lived.
 */
export function whatChanged(games: readonly GameMetrics[]): WhatChanged {
  const recent = games.slice(0, WINDOW);
  const previous = games.slice(WINDOW, WINDOW * 2);

  if (recent.length < WINDOW || previous.length < WINDOW) {
    const need = WINDOW * 2 - games.length;
    return {
      available: false,
      sentences: [
        games.length === 0
          ? `Once you have ${String(WINDOW * 2)} analysed games this will compare your last ${String(WINDOW)} with the ${String(WINDOW)} before.`
          : `This compares your last ${String(WINDOW)} games with the ${String(WINDOW)} before, so it needs ${plural(need, 'more game')}. You have ${plural(games.length, 'analysed game')}.`,
      ],
      recentGames: recent.length,
      previousGames: previous.length,
    };
  }

  const now = totalsOf(recent);
  const then = totalsOf(previous);
  const sentences: string[] = [];

  // Themes, in the order they cost the most NOW, so the sentence a learner reads
  // first is about the problem they currently have.
  const themes = [...TYPICAL_THEMES, 'unclassified' as const] as Theme[];
  const ranked = themes
    .map((theme) => ({
      theme,
      nowRate: ratePerGame(now.themeCounts[theme], now.games) ?? 0,
      thenRate: ratePerGame(then.themeCounts[theme], then.games) ?? 0,
    }))
    .sort((a, b) => b.nowRate - a.nowRate || a.theme.localeCompare(b.theme));

  for (const r of ranked) {
    const name = THEME_NAME[r.theme].toLowerCase();
    const delta = r.nowRate - r.thenRate;
    if (r.thenRate > 0 && r.nowRate === 0) {
      sentences.push(`You have stopped ${gerund(r.theme)}.`);
    } else if (delta <= -MATERIAL_CHANGE) {
      sentences.push(`${capitalise(name)} is down, from ${fmt(r.thenRate)} to ${fmt(r.nowRate)} a game.`);
    } else if (delta >= MATERIAL_CHANGE) {
      sentences.push(`${capitalise(name)} is up, from ${fmt(r.thenRate)} to ${fmt(r.nowRate)} a game.`);
    } else if (r.nowRate > 0 && r.thenRate > 0) {
      sentences.push(`${capitalise(name)} has not changed, at about ${fmt(r.nowRate)} a game.`);
    }
    // A theme that was zero and is still zero produces no sentence: there is
    // nothing to report, and "you still never miss a mate in one" reads as a
    // reminder that you might.
  }

  // Accuracy, one sentence per phase that has a number in BOTH windows. A phase
  // measured in only one window cannot be compared, and reporting the one number
  // as a change would make a first endgame look like an improvement.
  for (const phase of ['opening', 'middlegame', 'endgame'] as const) {
    const a = now.accuracyByPhase[phase];
    const b = then.accuracyByPhase[phase];
    if (a === null || b === null) continue;
    const d = a - b;
    if (Math.abs(d) < 2) continue;
    sentences.push(
      `Your ${phase} accuracy is ${d > 0 ? 'up' : 'down'}, from ${String(b)}% to ${String(a)}%.`,
    );
  }

  if (sentences.length === 0) {
    sentences.push(`Nothing has changed much between your last ${String(WINDOW)} games and the ${String(WINDOW)} before.`);
  }

  return { available: true, sentences, recentGames: recent.length, previousGames: previous.length };
}

/** The verb phrase for "you have stopped ...". */
function gerund(theme: Theme): string {
  switch (theme) {
    case 'hung_piece':
      return 'leaving pieces free to take';
    case 'missed_capture':
      return 'missing free material';
    case 'missed_mate':
      return 'missing mate in one';
    case 'ignored_threat':
      return 'ignoring your opponent’s threats';
    case 'unclassified':
      return 'making mistakes the analysis cannot name';
  }
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** One decimal, because these are rates below ten and "0.30" reads as precision. */
function fmt(rate: number): string {
  return rate.toFixed(1);
}
