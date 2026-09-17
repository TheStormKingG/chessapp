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

export interface BoardProps {
  fen: string;
  orientation: 'w' | 'b';
  mode: BoardMode;
  onMove?: (m: BoardMove) => void;
  onSelectSquare?: (sq: Square) => void;
  highlights?: Partial<Record<Square, HighlightKind>>;
  arrows?: Arrow[];
  disabled?: boolean;
  textEntry?: boolean;
  announce?: string;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}
