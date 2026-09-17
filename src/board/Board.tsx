import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Chessboard, defaultPieces } from 'react-chessboard';
import type { PieceDropHandlerArgs, SquareHandlerArgs } from 'react-chessboard';
import { applyMove, legalMoves, type Square } from '@/rules';
import { describeSquare } from './describeSquare';
import { handleDrop } from './dropHandler';
import type { BoardProps, BoardMove, HighlightKind, MarkKind } from './types';
import { CoordinateRail } from './CoordinateRail';
import { RAIL_REM, railFiles, railRanks } from './rail';
import { TextMoveEntry } from './TextMoveEntry';
import { useBoardA11y } from './useBoardA11y';
import {
  currentAppearance,
  pickReadable,
  resolveBoardPalette,
  withAlpha,
  type Appearance,
  type BoardPalette,
} from './boardColors';

/**
 * A3 / DESIGN-SYSTEM.md 5: the board carries TWO meanings, not three.
 *
 * `good` says "here" and `review` says "look again". The old `danger` red is
 * gone from the board: red-on-green is the worst pair for deuteranopia, and the
 * refutation is already carried by the opponent's replayed reply, which says
 * more than a red square ever did. `--danger` survives for destructive UI only.
 *
 * The `danger` name is kept as an accepted mark kind so callers outside
 * `src/board` (the lesson refutation arrow, the play screen's threat arrows)
 * keep compiling, but it now paints in the review hue: three board hues become
 * two, which is exactly the change the document asks for.
 *
 * F-AX-2 is untouched. Every kind still differs in SHAPE as well as colour --
 * good = 5px inset ring, review = dashed outline, danger/refuted = thin ring
 * plus diagonal hatch, selected = solid fill -- so colour is never the sole
 * carrier. The 5px inset geometry is asserted by three specs and is load
 * bearing; do not round it.
 */
const MARK_TOKEN: Record<MarkKind, '--mark-good' | '--mark-review'> = {
  accent: '--mark-good',
  review: '--mark-review',
  danger: '--mark-review',
};

function highlightStyles(p: BoardPalette): Record<HighlightKind, CSSProperties> {
  const good = p[MARK_TOKEN.accent];
  const review = p[MARK_TOKEN.review];
  return {
    accent: { boxShadow: `inset 0 0 0 5px ${good}` },
    review: { outline: `3px dashed ${review}`, outlineOffset: '-4px' },
    danger: {
      boxShadow: `inset 0 0 0 3px ${review}`,
      backgroundImage: `repeating-linear-gradient(45deg, ${withAlpha(review, 0.4)} 0 4px, transparent 4px 10px)`,
    },
    selected: { background: withAlpha(good, 0.35) },
  };
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** a1 is a dark square: an even file+rank index sum is dark. */
function isDarkSquare(sq: string): boolean {
  return (sq.charCodeAt(0) - 97 + (sq.charCodeAt(1) - 49)) % 2 === 0;
}

/** Re-resolves the board tokens whenever the appearance changes. */
function useBoardPalette(): { palette: BoardPalette; appearance: Appearance } {
  const [appearance, setAppearance] = useState<Appearance>(currentAppearance);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq?.addEventListener) return;
    const onChange = () => setAppearance(currentAppearance());
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const palette = useMemo(() => resolveBoardPalette(appearance), [appearance]);
  return { palette, appearance };
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

  const { palette, appearance } = useBoardPalette();

  // Glyph and cursor ink is picked per square, not per appearance: see
  // pickReadable. `--content` / `--surface` are the only two candidates, so the
  // board never invents an ink of its own.
  const inkOn = useCallback(
    (square: string) =>
      pickReadable(
        [palette['--content'], palette['--surface']],
        palette[isDarkSquare(square) ? '--board-dark' : '--board-light'],
      ),
    [palette],
  );

  const squareStyles = useMemo(() => {
    const styles = highlightStyles(palette);
    const s: Record<string, CSSProperties> = {};
    for (const [sq, kind] of Object.entries(highlights)) if (kind) s[sq] = { ...styles[kind] };
    if (selected) s[selected] = { ...(s[selected] ?? {}), ...styles.selected };
    s[cursor] = { ...(s[cursor] ?? {}), outline: `3px solid ${inkOn(cursor)}`, outlineOffset: '-3px' };
    return s;
  }, [highlights, selected, cursor, palette, inkOn]);

  // The piece rule (DESIGN-SYSTEM.md 3.1): every piece is a fill plus a 1.5px
  // outline in the OPPOSING piece colour, and max(fill, outline) must clear 3:1
  // on both squares. react-chessboard lets the fill be set per piece but hard
  // codes the outline to #000000 for both colours, which is only the opposing
  // colour for white pieces. Measured, that fails exactly one combination: a
  // dark piece on --board-dark in the dark appearance is fill 2.21 and outline
  // 2.60. The scoped rule below gives dark pieces their light outline in the
  // dark appearance, taking that combination to 7.41. Nothing changes in the
  // light appearance, where the dark fill already measures 5.00 and 13.58.
  const pieces = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(defaultPieces).map(([name, Piece]) => [
          name,
          (props?: { fill?: string; square?: string; svgStyle?: CSSProperties }) => (
            <Piece
              {...props}
              fill={palette[name.startsWith('w') ? '--piece-light' : '--piece-dark']}
            />
          ),
        ]),
      ),
    [palette],
  );

  const options = useMemo(
    () => ({
      position: fen,
      boardOrientation: orientation === 'w' ? ('white' as const) : ('black' as const),
      allowDragging: mode === 'play' && !disabled,
      showAnimations: !prefersReducedMotion(),
      animationDurationInMs: 200,
      squareStyles,
      pieces,
      lightSquareStyle: { backgroundColor: palette['--board-light'] },
      darkSquareStyle: { backgroundColor: palette['--board-dark'] },
      // C-2, finished. A3 left the glyphs on the squares at an interim ink
      // picked per square, because a board-vision curriculum with no
      // coordinates at all was the worse defect; the rail is the structural
      // answer the document asked for. Off the squares entirely, so
      // react-chessboard's wooden-board defaults (#B58863 at 2.47:1, #F0D9B5
      // at 1.88:1) cannot render either -- the rail below carries every rank
      // and file in --content on the page ground instead.
      showNotation: false,
      arrows: arrows.map((a) => ({
        startSquare: a.from,
        endSquare: a.to,
        color: palette[MARK_TOKEN[a.color ?? 'accent']],
      })),
      onPieceDrag: () => onDragStart?.(),
      onPieceDragCancel: () => onDragEnd?.(),
      onPieceDrop: ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
        onDragEnd?.();
        return tryMove(sourceSquare as Square, (targetSquare ?? null) as Square | null);
      },
      onSquareClick: ({ square }: SquareHandlerArgs) => activate(square as Square),
    }),
    [fen, orientation, mode, disabled, squareStyles, arrows, tryMove, activate, onDragStart, onDragEnd, palette, pieces],
  );

  return (
    <div className="w-full" data-board-root>
      {appearance === 'dark' && (
        <style>{`[data-board-root] [data-piece^="b"] svg * { stroke: ${palette['--piece-light']} !important; }`}</style>
      )}
      {/*
        The rail sits in the gutter the board is already inset by, not beside
        it: the negative margin pulls the whole block left by exactly the rail
        width, so on a 390px phone the board keeps the same width it had before
        the rail existed and only the page padding is spent. DESIGN-SYSTEM.md
        §4; `branding.md > Best practices`, "branding always defers to content".

        `role="application"` stays on the board alone, so the board's one tab
        stop, its accessible name, the keyboard cursor and the dnd-kit sweep in
        `neutraliseDndKit` are all unchanged -- and the sweep's invariant holds,
        because the rails are siblings of that container and carry no live
        region. The rails are `aria-hidden`: describeSquare already announces
        every coordinate.
      */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: `${String(RAIL_REM)}rem minmax(0, 1fr)`,
          marginLeft: `-${String(RAIL_REM)}rem`,
        }}
      >
        <CoordinateRail axis="rank" items={railRanks(orientation)} />
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
        <div />
        <CoordinateRail axis="file" items={railFiles(orientation)} />
      </div>
      <p role="status" aria-live="polite" aria-label="Board announcements" className="sr-only">{announce ?? status}</p>
      {textEntry && <TextMoveEntry onSubmit={onText} />}
    </div>
  );
}
