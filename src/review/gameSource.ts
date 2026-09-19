import type { LearnerEvent } from '@/data';
import { START_FEN, applyMove, toUci } from '@/rules';
import type { ReviewSource } from './types';

/**
 * Where a review's input comes from.
 *
 * A finished in-app game is recorded as TWO events (src/play/useGame.ts):
 * `game_started`, which carries the learner's colour, and `game_finished`,
 * which carries the moves as space-joined SAN. Neither alone is enough, so this
 * joins them on gameId. The `games` table in src/data/db.ts exists but is never
 * written to; do not read it.
 *
 * Import (PRD F-RV-9, out of scope for this plan) would build the same
 * ReviewSource from a PGN and everything downstream would be unchanged. This
 * function is the seam.
 */
export function sourceFromEvents(events: LearnerEvent[], gameId: string): ReviewSource | null {
  let start: Extract<LearnerEvent['payload'], { type: 'game_started' }> | null = null;
  let end: Extract<LearnerEvent['payload'], { type: 'game_finished' }> | null = null;
  let startedAt = '';

  for (const e of events) {
    const p = e.payload;
    if (p.type === 'game_started' && p.gameId === gameId) {
      start = p;
      startedAt = e.createdAt;
    } else if (p.type === 'game_finished' && p.gameId === gameId) {
      end = p;
    }
  }
  if (!start || !end) return null;

  const sans = end.pgn.split(/\s+/).filter(Boolean);
  if (sans.length === 0) return null;

  return {
    gameId,
    learner: start.color,
    persona: start.persona,
    sans,
    result: end.result,
    timeControl: start.timeControl,
    startedAt,
  };
}

export interface Positions {
  /** `fens[0]` is the start; `fens[i + 1]` is the position after `sans[i]`. */
  fens: string[];
  /** `ucis[i]` is `sans[i]` in UCI. */
  ucis: string[];
}

/**
 * Replays the SAN list from the standard start.
 *
 * Sound because the app has no Chess960 and no play from a set position: every
 * game recorded by `game_finished` began at START_FEN. If that ever stops being
 * true, `game_finished` must start carrying a start FEN and this function must
 * take one.
 */
export function positionsOf(sans: string[]): Positions {
  const fens = [START_FEN];
  const ucis: string[] = [];
  let fen = START_FEN;
  for (let i = 0; i < sans.length; i += 1) {
    const san = sans[i];
    if (san === undefined) throw new Error(`game does not replay: ply ${i}, SAN undefined`);
    let uci: string;
    try {
      uci = toUci(fen, san);
    } catch {
      throw new Error(`game does not replay: ply ${i}, SAN ${JSON.stringify(san)}`);
    }
    const r = applyMove(fen, uci);
    fen = r.fen;
    fens.push(fen);
    ucis.push(uci);
  }
  return { fens, ucis };
}
