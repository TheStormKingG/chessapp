import type { Square } from '@/rules';

export type BoardMode = 'play' | 'select' | 'static';
export type HighlightKind = 'accent' | 'review' | 'danger' | 'selected';

export interface BoardMove {
  from: Square;
  to: Square;
  uci: string;
  san: string;
}

export interface Arrow {
  from: Square;
  to: Square;
  color?: 'accent' | 'review' | 'danger';
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
