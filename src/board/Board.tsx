import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Chessboard } from 'react-chessboard';
import type { PieceDropHandlerArgs, SquareHandlerArgs } from 'react-chessboard';
import { applyMove, legalMoves, type Square } from '@/rules';
import { describeSquare } from './describeSquare';
import { handleDrop } from './dropHandler';
import type { BoardProps, BoardMove, HighlightKind } from './types';
import { TextMoveEntry } from './TextMoveEntry';
import { useBoardA11y } from './useBoardA11y';

// F-AX-2: each highlight kind differs in shape as well as colour, so none
// relies on red/green alone. accent = thick inset ring, review = dashed
// outline, danger = thin ring plus diagonal hatch, selected = solid fill.
const HIGHLIGHT_STYLES: Record<HighlightKind, CSSProperties> = {
  accent: { boxShadow: 'inset 0 0 0 5px rgba(31,95,74,0.75)' },
  review: { outline: '3px dashed rgba(184,134,11,0.95)', outlineOffset: '-4px' },
  danger: {
    boxShadow: 'inset 0 0 0 3px rgba(162,59,59,0.85)',
    backgroundImage:
      'repeating-linear-gradient(45deg, rgba(162,59,59,0.35) 0 4px, transparent 4px 10px)',
  },
  selected: { background: 'rgba(31,95,74,0.35)' },
};
const ARROW_COLORS = { accent: '#1f5f4a', review: '#b8860b', danger: '#a23b3b' } as const;
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function Board(props: BoardProps) {
  const {
    fen, orientation, mode, onMove, onSelectSquare, highlights = {}, arrows = [],
    disabled, textEntry, announce, onDragStart, onDragEnd,
  } = props;
  const [selected, setSelected] = useState<Square | null>(null);
  const [status, setStatus] = useState('');
  // M-1: flipping the board restarts the keyboard cursor at the player's near
  // corner (see useBoardA11y), so any square selected before the flip must be
  // released with it -- otherwise the user is silently still holding a piece
  // and their next activation reports a spurious illegal move. Adjusted during
  // render, matching the cursor reset (a setState-in-effect is lint-banned).
  const [prevOrientation, setPrevOrientation] = useState(orientation);
  if (prevOrientation !== orientation) {
    setPrevOrientation(orientation);
    setSelected(null);
  }

  const tryMove = useCallback(
    (from: Square, to: Square | null): boolean => {
      const mv: BoardMove | null = handleDrop(fen, mode, disabled, from, to);
      if (!mv) return false;
      setSelected(null);
      setStatus(`You played ${mv.san}.`);
      onMove?.(mv);
      return true;
    },
    [fen, mode, disabled, onMove],
  );

  const activate = useCallback(
    (sq: Square) => {
      if (disabled) return;
      if (mode === 'select') {
        onSelectSquare?.(sq);
        setStatus(describeSquare(fen, sq));
        return;
      }
      if (mode !== 'play') return;
      if (selected) {
        if (selected === sq) { setSelected(null); setStatus(`Deselected ${sq}.`); return; }
        if (!tryMove(selected, sq)) {
          // Tapping another own piece re-selects it; anything else is illegal.
          if (legalMoves(fen, sq).length > 0) { setSelected(sq); setStatus(`Selected ${describeSquare(fen, sq)}.`); }
          else { setSelected(null); setStatus(`Not a legal move to ${sq}.`); }
        }
        return;
      }
      if (legalMoves(fen, sq).length > 0) { setSelected(sq); setStatus(`Selected ${describeSquare(fen, sq)}.`); }
      else setStatus(describeSquare(fen, sq));
    },
    [disabled, mode, selected, fen, tryMove, onSelectSquare],
  );

  const { cursor, onKeyDown } = useBoardA11y(orientation, activate);

  // I-3: every cursor move is announced through the live region, not via
  // the container label (label changes are not read by screen readers).
  const prevCursor = useRef(cursor);
  useEffect(() => {
    if (prevCursor.current === cursor) return;
    prevCursor.current = cursor;
    setStatus(describeSquare(fen, cursor));
    // fen intentionally omitted: a position change alone should not re-announce the cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  // I-1: react-chessboard renders each piece as a dnd-kit draggable
  // (role=button, tabindex=0, aria-describedby -> dnd-kit keyboard
  // instructions) plus its own assertive live region. Inside our
  // application-role container those are 32 extra tab stops, wrong
  // instructions and duplicate announcements, and the library exposes no
  // option to turn them off. Neutralise them in the DOM after every render
  // and whenever the library re-creates piece nodes.
  // The role="button" each piece carries is removed too (WCAG 4.1.2): the
  // library gives those nodes no accessible name, so browse mode met 32
  // nameless buttons. Naming them would be worse than removing the role --
  // they are not controls for us (we strip their tab stops, and every piece is
  // already reachable and described through the board's own keyboard cursor
  // and describeSquare readout), so announcing 32 "buttons" that cannot be
  // focused or activated would advertise an interaction that does not exist.
  // Without an explicit role, the leftover aria-roledescription="draggable"
  // applies to a generic element and is ignored, which is the intent.
  const appRef = useRef<HTMLDivElement>(null);
  const neutraliseDndKit = useCallback(() => {
    const root = appRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>('[aria-roledescription="draggable"]').forEach((el) => {
      if (el.getAttribute('tabindex') !== '-1') el.setAttribute('tabindex', '-1');
      if (el.hasAttribute('aria-describedby')) el.removeAttribute('aria-describedby');
      if (el.hasAttribute('role')) el.removeAttribute('role');
    });
    // Invariant this sweep depends on: none of OUR live regions may live
    // inside the role="application" container -- it hides every [aria-live]
    // element found there. The board's own status region is a sibling of the
    // container, below it in the returned tree; keep it that way.
    root.querySelectorAll<HTMLElement>('[aria-live]').forEach((el) => {
      if (el.getAttribute('aria-hidden') !== 'true') el.setAttribute('aria-hidden', 'true');
    });
  }, []);
  // Run after every commit (layout + passive, so library nodes created in
  // the children's own effects are caught synchronously within the commit)
  // and via a MutationObserver for nodes the library adds outside React.
  useLayoutEffect(neutraliseDndKit);
  useEffect(neutraliseDndKit);
  useLayoutEffect(() => {
    const root = appRef.current;
    if (!root) return;
    const mo = new MutationObserver(neutraliseDndKit);
    mo.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['tabindex', 'aria-describedby', 'aria-live', 'role'],
    });
    return () => mo.disconnect();
  }, [neutraliseDndKit]);

  const onText = useCallback(
    (text: string) => {
      if (disabled) return;
      if (mode === 'select') {
        const sq = text.toLowerCase();
        if (/^[a-h][1-8]$/.test(sq)) { onSelectSquare?.(sq as Square); setStatus(describeSquare(fen, sq as Square)); }
        else setStatus(`${text} is not a square.`);
        return;
      }
      if (mode !== 'play') return;
      try {
        const r = applyMove(fen, text);
        setSelected(null);
        setStatus(`You played ${r.san}.`);
        onMove?.({ from: r.uci.slice(0, 2) as Square, to: r.uci.slice(2, 4) as Square, uci: r.uci, san: r.san });
      } catch {
        setStatus(`${text} is not a legal move.`);
      }
    },
    [fen, mode, disabled, onMove, onSelectSquare],
  );

  const squareStyles = useMemo(() => {
    const s: Record<string, CSSProperties> = {};
    for (const [sq, kind] of Object.entries(highlights)) if (kind) s[sq] = { ...HIGHLIGHT_STYLES[kind] };
    if (selected) s[selected] = { ...(s[selected] ?? {}), ...HIGHLIGHT_STYLES.selected };
    s[cursor] = { ...(s[cursor] ?? {}), outline: '3px solid #1b1f1d', outlineOffset: '-3px' };
    return s;
  }, [highlights, selected, cursor]);

  const options = useMemo(
    () => ({
      position: fen,
      boardOrientation: orientation === 'w' ? ('white' as const) : ('black' as const),
      allowDragging: mode === 'play' && !disabled,
      showAnimations: !prefersReducedMotion(),
      animationDurationInMs: 200,
      squareStyles,
      lightSquareStyle: { backgroundColor: '#e8e4d6' },
      darkSquareStyle: { backgroundColor: '#8fa889' },
      arrows: arrows.map((a) => ({ startSquare: a.from, endSquare: a.to, color: ARROW_COLORS[a.color ?? 'accent'] })),
      onPieceDrag: () => onDragStart?.(),
      onPieceDragCancel: () => onDragEnd?.(),
      onPieceDrop: ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
        onDragEnd?.();
        return tryMove(sourceSquare as Square, (targetSquare ?? null) as Square | null);
      },
      onSquareClick: ({ square }: SquareHandlerArgs) => activate(square as Square),
    }),
    [fen, orientation, mode, disabled, squareStyles, arrows, tryMove, activate, onDragStart, onDragEnd],
  );

  return (
    <div className="w-full">
      <div
        ref={appRef}
        role="application"
        aria-label={`Chess board, ${orientation === 'w' ? 'white' : 'black'} at the bottom`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="w-full touch-none outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Chessboard options={options} />
      </div>
      <p role="status" aria-live="polite" aria-label="Board announcements" className="sr-only">{announce ?? status}</p>
      {textEntry && <TextMoveEntry onSubmit={onText} />}
    </div>
  );
}
