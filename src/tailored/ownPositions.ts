import type { LearnerEvent } from '@/data/events';
import type { ImportedGameRow } from '@/import/types';
import type { Review } from '@/review/types';

/**
 * F-TS-3's "the learner's own games (the position before the mistake, with the
 * opponent's move replayed)" and F-TS-4's "own positions first".
 *
 * ── WHAT "WITH THE OPPONENT'S MOVE REPLAYED" CAN MEAN IN EACH PLAYER ─────────
 *
 * A `Puzzle` carries a move list and `PuzzlePlayer` plays `solution[0]` for the
 * opponent before the learner moves, so a practice-set item can replay the move
 * literally: start one ply earlier and let the board make it.
 *
 * A lesson `Challenge` cannot. It carries a single `fen` and nothing that says
 * "play this first", and the eight challenge types are a closed union whose every
 * consumer switches exhaustively over it. So the tailored LESSON does what the
 * authored corpus does in exactly this situation — content/section-2/unit-2.1's
 * `2.1.1-c6` opens "Black has just played the queen to d5, attacking your knight on
 * f3" — and states the opponent's move in the prompt over the position it produced.
 * That is the requirement honoured in the medium's own terms, not skipped: the
 * distinction is recorded here because a reader comparing the two players would
 * otherwise think one of them had lost the replay.
 *
 * `lead` carries what a literal replay needs, so the practice set can have it and
 * the lesson can name it.
 */

/** A dated game with a review and, where known, who the opponent was. */
export interface OwnGame {
  gameId: string;
  /** ISO 8601, when the game was played. */
  playedAt: string;
  /** The opponent's name, or null when nothing recorded one. */
  opponent: string | null;
  review: Review;
}

export interface OwnCandidate {
  gameId: string;
  ply: number;
  theme: string;
  /** The position before the mistake. The learner is to move. */
  fen: string;
  /** The engine's move there, as the review recorded it. */
  bestUci: string;
  bestSan: string;
  /** What the learner actually played, for a prompt that can name it. */
  playedSan: string;
  /**
   * The opponent's move that produced `fen`, when there was one. Null for a
   * mistake on the learner's first move of the game, where no move preceded it.
   */
  lead: { fen: string; uci: string; san: string } | null;
  /** F-TS-3's "This is from your game against Rosa on Tuesday". */
  provenance: string;
  /** How recent the game is: 0 is the most recent game in the window. */
  gameRank: number;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/**
 * F-TS-3's sentence fragment, built only from what is recorded.
 *
 * A weekday for a game inside the last week, because "on Tuesday" is how a learner
 * remembers a game from Tuesday; a date beyond that, because "on Tuesday" for a
 * game five weeks ago is a small lie. An unknown opponent is not invented: the
 * fragment drops the name rather than guessing one.
 */
export function gameReference(game: { opponent: string | null; playedAt: string }, now: Date): string {
  const played = new Date(game.playedAt);
  if (Number.isNaN(played.getTime())) return game.opponent ? `your game against ${game.opponent}` : 'one of your games';
  const days = Math.floor((now.getTime() - played.getTime()) / 86_400_000);
  const when =
    days < 7 && days >= 0
      ? `on ${WEEKDAYS[played.getDay()] ?? ''}`
      : `on ${played.getDate()} ${MONTHS[played.getMonth()] ?? ''}`;
  return game.opponent ? `your game against ${game.opponent} ${when}` : `your game ${when}`;
}

/**
 * The learner's own positions for one theme, most recent game first.
 *
 * Recency order is inherited from the caller's game order, which `buildProfile`
 * already establishes (newest first) — the same order F-SW-3's weighting reads. It
 * is not re-derived here, because two places deciding what "recent" means is how
 * they come to disagree.
 */
export function ownCandidates(input: { games: readonly OwnGame[]; theme: string; now: Date }): OwnCandidate[] {
  const out: OwnCandidate[] = [];
  input.games.forEach((game, gameRank) => {
    const learner = game.review.learner;
    const byPly = new Map(game.review.moves.map((m) => [m.ply, m]));
    for (const e of game.review.errors) {
      if (e.theme !== input.theme) continue;
      const previous = byPly.get(e.ply - 1);
      // Only a move by the OTHER side can be the opponent's lead-in. A learner
      // moving twice in a row is impossible, but reading the previous ply without
      // checking would silently make the learner replay their own move as the
      // opponent's if a review were ever built from an odd move list.
      const lead =
        previous && previous.mover !== learner
          ? { fen: previous.fenBefore, uci: previous.uci, san: previous.san }
          : null;
      out.push({
        gameId: game.gameId,
        ply: e.ply,
        theme: e.theme,
        fen: e.fenBefore,
        bestUci: e.bestUci,
        bestSan: e.bestSan,
        playedSan: e.playedSan,
        lead,
        provenance: gameReference(game, input.now),
        gameRank,
      });
    }
  });
  return out;
}

/**
 * Who the learner played, per game, from the two places that know.
 *
 * An imported game carries the opponent's name as the source site spells it. An
 * in-app game carries a persona ID on `game_started`, and the id is all the log
 * holds — `personaNames` maps the ones the app ships. An unmapped id yields null
 * rather than a prettified id: "your game against rosa" would be a display bug
 * wearing a name.
 */
export function opponentNames(input: {
  imported: readonly ImportedGameRow[];
  events: readonly LearnerEvent[];
  personaNames: Readonly<Record<string, string>>;
}): Map<string, string> {
  const names = new Map<string, string>();
  for (const row of input.imported) names.set(row.gameId, row.opponent);
  for (const e of input.events) {
    const p = e.payload;
    if (p.type !== 'game_started') continue;
    const name = input.personaNames[p.persona];
    if (name !== undefined && !names.has(p.gameId)) names.set(p.gameId, name);
  }
  return names;
}
