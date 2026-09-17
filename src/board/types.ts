import type { Square } from '@/rules';

export type BoardMode = 'play' | 'select' | 'static';

/**
 * The marks the board can paint. DESIGN-SYSTEM.md 5 takes red off the board:
 * `accent` paints in `--mark-good` ("here") and BOTH `review` and `danger`
 * paint in `--mark-review` ("look again"), so the board carries two hues rather
 * than three. `danger` keeps its name because callers outside `src/board` pass
 * it (the lesson's refutation arrow, the play screen's threat arrows) and the
 * meaning -- a move that punishes you -- is unchanged; only the colour moved.
 * The shapes stay distinct regardless, per F-AX-2.
 */
export type MarkKind = 'accent' | 'review' | 'danger';
export type HighlightKind = MarkKind | 'selected';

export interface BoardMove {
  from: Square;
  to: Square;
  uci: string;
  san: string;
}

export interface Arrow {
  from: Square;
  to: Square;
  color?: MarkKind;
}

/**
 * D1 -- a refutation the learner can watch. Self-contained on purpose: the
 * board is handed a position and the moves to play out from it, so it never has
 * to know what a lesson, a challenge or an engine is, and the same replay works
 * on any surface that mounts a board.
 */
export interface Replay {
  /** The position the replay starts from: the one before the learner's move. */
  fen: string;
  /**
   * UCI moves played out from `fen`, in order. Today that is two -- the wrong
   * move the learner just made, then the reply that punishes it -- because
   * seeing only the answer to a move you can no longer see on the board is the
   * half of the story the arrow already told.
   */
  moves: string[];
  /** SAN of the last move, for the live region. Reduced motion reads this. */
  san: string;
}

export interface BoardProps {
  fen: string;
  orientation: 'w' | 'b';
  mode: BoardMode;
  onMove?: (m: BoardMove) => void;
  onSelectSquare?: (sq: Square) => void;
  highlights?: Partial<Record<Square, HighlightKind>>;
  arrows?: Arrow[];
  /**
   * A refutation to play out on the board. Non-null starts it; the board
   * restores its own `fen` when it ends, so the position the caller owns is
   * never actually changed.
   */
  replay?: Replay | null;
  disabled?: boolean;
  textEntry?: boolean;
  announce?: string;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}
