import {
  START_FEN,
  applyMove,
  gameStatus,
  isCheck,
  pieceAt,
  turn,
  type Color,
  type GameStatus,
  type Square,
} from '@/rules';
import { hangingPieces, justCastled, mateInOne, threatsAgainst, winningCaptures } from '@/tagger';
import { CoachService, type CoachEvent as CoachTemplate, type CoachFacts } from '@/coach';
import type { Arrow, HighlightKind } from '@/board';

export type TimeControl = 'untimed' | '10+0';

/** Ten minutes a side, no increment — the only clock in Phase 0 (PRD F-PL-5; 15+10 is Alpha). */
export const TEN_MINUTES_MS = 600_000;

/**
 * How a game ended. `gameStatus` covers everything the rules decide; resignation and
 * timeout are decided by the app, so they are added here rather than faked as a checkmate.
 */
export type GameEnd = GameStatus | { over: true; result: 'resignation' | 'timeout'; winner: Color };

export interface GameState {
  id: string;
  learner: Color;
  persona: string;
  timeControl: TimeControl;
  coach: boolean;
  fen: string;
  turn: Color;
  /** Every position reached, oldest first; `history[0]` is the start. Take-backs pop from the end. */
  history: string[];
  sans: string[];
  hints: number;
  takebacks: number;
  hintLevel: 0 | 1 | 2;
  highlights: Partial<Record<Square, HighlightKind>>;
  arrows: Arrow[];
  clockMs: { w: number; b: number } | null;
  over: GameEnd;
}

function other(c: Color): Color {
  return c === 'w' ? 'b' : 'w';
}

export function initGame(o: {
  learner: Color;
  persona: string;
  timeControl: TimeControl;
  coach: boolean;
}): GameState {
  return {
    id: crypto.randomUUID(),
    ...o,
    fen: START_FEN,
    turn: 'w',
    history: [START_FEN],
    sans: [],
    hints: 0,
    takebacks: 0,
    hintLevel: 0,
    highlights: {},
    arrows: [],
    clockMs: o.timeControl === '10+0' ? { w: TEN_MINUTES_MS, b: TEN_MINUTES_MS } : null,
    over: { over: false },
  };
}

function push(g: GameState, uci: string): GameState {
  if (g.over.over) return g;
  const r = applyMove(g.fen, uci);
  return {
    ...g,
    fen: r.fen,
    turn: turn(r.fen),
    history: [...g.history, r.fen],
    sans: [...g.sans, r.san],
    hintLevel: 0,
    highlights: {},
    arrows: [],
    over: gameStatus(r.fen),
  };
}

export function applyLearnerMove(g: GameState, uci: string): GameState {
  return push(g, uci);
}

export function applyBotMove(g: GameState, uci: string): GameState {
  return push(g, uci);
}

/**
 * Unlimited take-backs (PRD F-PL-3): rewind to the most recent position in which it is
 * the learner's turn again. That is normally two plies, but it is one when the game ended
 * on the learner's own move and it is none at all when there is nothing to undo — so the
 * number of plies is derived from the restored position's side to move rather than assumed.
 */
export function takeBack(g: GameState): GameState {
  for (let cut = 1; cut < g.history.length; cut++) {
    const history = g.history.slice(0, g.history.length - cut);
    const fen = history[history.length - 1]!;
    if (turn(fen) !== g.learner) continue;
    return {
      ...g,
      fen,
      turn: g.learner,
      history,
      sans: g.sans.slice(0, Math.max(0, g.sans.length - cut)),
      takebacks: g.takebacks + 1,
      hintLevel: 0,
      highlights: {},
      arrows: [],
      over: gameStatus(fen),
    };
  }
  return g;
}

/** Two-stage hints, piece first then square, counted once per move (PRD F-PL-3). */
export function applyHint(g: GameState, hint: { piece: Square; square: Square }): GameState {
  if (g.hintLevel >= 2) return g;
  const level = (g.hintLevel + 1) as 1 | 2;
  return {
    ...g,
    hintLevel: level,
    hints: level === 1 ? g.hints + 1 : g.hints,
    highlights:
      level === 1 ? { [hint.piece]: 'accent' } : { [hint.piece]: 'selected', [hint.square]: 'accent' },
  };
}

/** The opponent's current threats, as arrows (PRD F-PL-3). */
export function showThreats(g: GameState): GameState {
  const arrows: Arrow[] = threatsAgainst(g.fen)
    .captures.slice(0, 3)
    .map((c) => ({ from: c.uci.slice(0, 2) as Square, to: c.uci.slice(2, 4) as Square, color: 'danger' }));
  return { ...g, arrows };
}

export function resign(g: GameState): GameState {
  if (g.over.over) return g;
  return { ...g, over: { over: true, result: 'resignation', winner: other(g.learner) } };
}

/** Decrement the side to move; reaching zero ends the game as a loss for that side (PRD F-PL-5). */
export function tickClock(g: GameState, ms: number): GameState {
  if (!g.clockMs || g.over.over) return g;
  const side = g.turn;
  const left = Math.max(0, g.clockMs[side] - ms);
  const clockMs = { ...g.clockMs, [side]: left };
  if (left === 0) return { ...g, clockMs, over: { over: true, result: 'timeout', winner: other(side) } };
  return { ...g, clockMs };
}

/** 'win' / 'loss' / 'draw' from the learner's point of view; null while the game is running. */
export function resultFor(g: GameState): 'win' | 'loss' | 'draw' | null {
  if (!g.over.over) return null;
  if (g.over.winner === null) return 'draw';
  return g.over.winner === g.learner ? 'win' : 'loss';
}

/** A line the coach may say: a template key plus the verified facts that template needs. */
export interface CoachCue {
  event: CoachTemplate;
  facts: CoachFacts;
  tone: 'good' | 'bad' | 'neutral';
}

/**
 * At most one comment per learner move, in priority order (PRD F-PL-3). `before` is the
 * state before the move, `after` the FEN after it. Every fact is read off the position by
 * the tagger — nothing here is guessed (PRD F-CO-4).
 */
export function coachEventFor(before: GameState, uci: string, after: string): CoachCue | null {
  const me = before.learner;
  const r = applyMove(before.fen, uci);

  // A piece left hanging that was not hanging before the move.
  const hangBefore = new Set(hangingPieces(before.fen, me).map((h) => h.square));
  const newHang = hangingPieces(after, me).find((h) => !hangBefore.has(h.square));
  if (newHang) {
    return {
      event: 'hang',
      facts: { pieceName: CoachService.pieceName(newHang.piece), square: newHang.square },
      tone: 'bad',
    };
  }

  // A threat the opponent already had and the move did nothing about. The SAN is taken from
  // the position the opponent actually faces now, so it names a move they can really play.
  const threatened = threatsAgainst(before.fen).captures[0];
  if (threatened) {
    const still = winningCaptures(after).find((c) => c.target === threatened.target);
    if (still) return { event: 'threatIgnored', facts: { threatSan: still.san }, tone: 'bad' };
  }

  const free = winningCaptures(before.fen);
  if (free.length > 0 && !r.capture) {
    const missed = free[0]!;
    const victim = applyMove(before.fen, missed.uci);
    return {
      event: 'missedCapture',
      facts: { pieceName: CoachService.pieceName(victim.captured ?? 'p'), square: missed.target },
      tone: 'bad',
    };
  }

  if (r.capture && free.some((c) => c.uci === r.uci)) {
    return { event: 'goodCapture', facts: { pieceName: CoachService.pieceName(r.captured ?? 'p') }, tone: 'good' };
  }

  if (justCastled(r.san)) return { event: 'castled', facts: {}, tone: 'good' };

  return null;
}

/** Before the learner moves: prompt if they have a mate or are in check. */
export function preMoveEvent(g: GameState): CoachCue | null {
  if (g.over.over) return null;
  if (mateInOne(g.fen)) return { event: 'mateAvailable', facts: {}, tone: 'neutral' };
  if (isCheck(g.fen)) return { event: 'check', facts: {}, tone: 'neutral' };
  return null;
}

export function hintFromMove(uci: string): { piece: Square; square: Square } {
  return { piece: uci.slice(0, 2) as Square, square: uci.slice(2, 4) as Square };
}

/**
 * The facts the two hint templates need. `pieceName` is read off the board rather than
 * filled with a placeholder: the coach never says a word it has not verified (PRD F-CO-4).
 */
export function hintCue(g: GameState, h: { piece: Square; square: Square }, level: 1 | 2): CoachCue | null {
  const piece = pieceAt(g.fen, h.piece);
  if (!piece) return null;
  return {
    event: level === 1 ? 'hintPiece' : 'hintSquare',
    facts: { pieceName: CoachService.pieceName(piece.type), square: level === 1 ? h.piece : h.square },
    tone: 'neutral',
  };
}

/**
 * A hint when the engine is not available: only a capture the tagger has verified wins
 * material. Any legal move would also be a "hint", but the coach's hint templates assert
 * that the piece *wants* to go there, and that claim needs evidence (PRD F-CO-4) — so when
 * there is no verified move, there is no hint, and the caller shows the engine error instead.
 */
export function fallbackHint(fen: string): string | null {
  return winningCaptures(fen)[0]?.uci ?? null;
}
