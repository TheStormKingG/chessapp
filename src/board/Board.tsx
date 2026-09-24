import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { Chessboard, defaultPieces } from 'react-chessboard';
import type { PieceDropHandlerArgs, SquareHandlerArgs } from 'react-chessboard';
import { applyMove, legalMoves, type Square } from '@/rules';
import { useSettings } from '@/app/settings';
import { playMoveSound } from '@/audio/moveSound';
import { describeSquare } from './describeSquare';
import { handleDrop } from './dropHandler';
import type { BoardProps, BoardMove, HighlightKind, MarkKind, Replay } from './types';
import { CoordinateRail } from './CoordinateRail';
import { RAIL_REM, railFiles, railRanks } from './rail';
import { TextMoveEntry } from './TextMoveEntry';
import { useBoardA11y } from './useBoardA11y';
import {
  pickReadable,
  resolveBoardPalette,
  withAlpha,
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

/**
 * D1 -- the refutation replay. DESIGN-SYSTEM.md §6, "the one orchestrated
 * moment", and §5, which took red off the board on the argument that "the
 * refutation is already shown by an animated opponent reply, which is far more
 * informative than a red square". This is that reply; without it A3's removal
 * of the danger hue would have been a subtraction with nothing put in its place.
 *
 * Why motion is the content here rather than decoration, which is the test
 * `motion.md > Best practices` sets ("add motion purposefully... don't add
 * motion for the sake of adding motion"): the product's thesis is that mistakes
 * are the material (PRD §1.3 principle 1), and the distance between "that was
 * wrong" and knowing WHY is watching the piece travel. An arrow names the
 * refuting move to someone who can already read the position. Playing it shows
 * it to someone who cannot -- which is every learner this product is for.
 *
 * Both of the learner's moves are replayed, not just the answer. The wrong move
 * was reverted the moment it was judged, so a board that slides only the reply
 * is answering a move that is no longer on screen.
 *
 * Three obligations, all from the same page plus `accessibility.md > Motion`:
 *
 *   - BRIEF. Two slides and a hold: about 1.2 seconds of replay, then the
 *     learner's own position is back and the retry is live.
 *   - CANCELLABLE and SKIPPABLE. `motion.md`: "don't make people wait for an
 *     animation to complete before they can do anything, especially if they
 *     have to experience the animation more than once" -- and a learner who
 *     misses twice sees this twice. A Skip control sits on the board for the
 *     duration, and touching or typing at the board skips it too.
 *   - REDUCED MOTION GETS THE SAME INFORMATION, NOT LESS. The preference
 *     suppresses the travel, not the telling: the final position arrives at
 *     once and is then HELD for two seconds rather than 1.2, so the marked
 *     square and the arrow are on screen LONGER, and the move is announced in
 *     SAN through the board's existing live region on both paths. Nothing is
 *     available only to someone who can watch it move.
 */
const REPLAY_STEP_MS = 520;
const REPLAY_HOLD_MS = 1200;
const REPLAY_HOLD_REDUCED_MS = 2000;

/** Every position the replay passes through, plus the square that gets marked. */
function replayFrames(replay: Replay | null | undefined): { fens: string[]; to: Square } | null {
  const last = replay?.moves.at(-1);
  if (!replay || last === undefined) return null;
  try {
    const fens = [replay.fen];
    let cur = replay.fen;
    for (const uci of replay.moves) {
      cur = applyMove(cur, uci).fen;
      fens.push(cur);
    }
    return { fens, to: last.slice(2, 4) as Square };
  } catch {
    // A replay that does not fit its own position is dropped in silence: the
    // arrow and the coach's line already stand, and a half-played line would
    // teach something untrue.
    return null;
  }
}

/**
 * The frame a replay opens on: the first, or -- when motion is reduced -- the
 * last, because there is no travel to show and the destination is the point.
 * A board mounted with a replay already in hand starts here too, so the
 * caller's position is never rendered for a frame before the replay takes over.
 */
function openingStep(frames: { fens: string[] } | null): number | null {
  if (!frames) return null;
  return prefersReducedMotion() ? frames.fens.length - 1 : 0;
}

/** a1 is a dark square: an even file+rank index sum is dark. */
function isDarkSquare(sq: string): boolean {
  return (sq.charCodeAt(0) - 97 + (sq.charCodeAt(1) - 49)) % 2 === 0;
}

/**
 * Resolves the board tokens once. There is one appearance, so nothing can
 * change under the board at runtime and there is no media-query listener --
 * NEUMORPHIC-DELTA.md 4 removed the dark theme, and this hook is the second
 * place it lived.
 */
function useBoardPalette(): { palette: BoardPalette } {
  const palette = useMemo(() => resolveBoardPalette(), []);
  return { palette };
}

export function Board(props: BoardProps & { size?: number; decorative?: boolean; testId?: string }) {
  const {
    fen, orientation, mode, onMove, onSelectSquare, highlights = {}, arrows = [],
    replay = null, disabled, textEntry, announce, onDragStart, onDragEnd, size,
    decorative = false, testId,
  } = props;
  // P4b: `decorative` is the board as CONTEXT rather than as a control -- today
  // the 120px position on Today's lesson card, which sits inside the link that
  // opens the lesson. It is a smaller claim than `mode="static"`, which still
  // describes a board a keyboard user can walk with the cursor and hear
  // announced: a decorative board is hidden from assistive technology outright,
  // keeps no `application` role, no tab stop and no live region. That is
  // deliberate rather than a saving. Duplicating the full board's
  // accessibility into a thumbnail would put a second tab stop inside a single
  // destination and announce a playable board that cannot be played, and the
  // card's own text already says which lesson it is. The board contract is
  // therefore never "traded down" for size (see the sized-board test, which is
  // the negative control for this one) -- it is dropped only where the element
  // has stopped being a board and become a picture of one.
  //
  // Everything below reads `interactive`, never `!decorative`, so a future
  // third mode cannot silently inherit the wrong half.
  const interactive = !decorative;

  /*
   * ─── The move cue ─────────────────────────────────────────────────────────
   *
   * Fired from the POSITION changing, not from the learner's gesture.
   *
   * Hooking the drop handler would only ever sound the moves a learner makes
   * by hand, and miss the ones the app plays for them: a revealed answer, a
   * coached game's reply, a refutation replayed on the board. Those are the
   * moves a beginner most needs marked, because they happen without warning.
   *
   * So the fen is diffed. If exactly one legal move connects the previous
   * position to the new one, that was the move, and its own result says
   * whether it was a capture or a check. A change that no single move explains
   * -- a new challenge, a reset, a jump -- is silent, which is right: nothing
   * moved, the board was replaced.
   *
   * Decorative boards never sound. Today's card carries a 120px position that
   * changes whenever the next lesson changes, and it is a picture, not a move.
   */
  /*
   * The mute flag is READ at the moment a sound would play, not subscribed to.
   *
   * Subscribing (`useSettings((s) => s.soundMuted)`) made every board re-render
   * when the store hydrated, and react-chessboard measures its squares in a
   * mount effect -- during that extra render the container has no layout in
   * jsdom and it throws "Square width not found". Five FixItDrill tests went
   * red on a change that was only supposed to add a sound.
   *
   * Reading at the point of use is also simply correct for a fire-and-forget
   * cue: the value matters for the microsecond the sound starts, and nothing
   * about the board's rendering depends on it, so a subscription buys a
   * re-render of every board on every settings change and nothing else.
   */
  const prevFen = useRef(fen);
  useEffect(() => {
    const from = prevFen.current;
    prevFen.current = fen;
    if (from === fen || decorative || useSettings.getState().soundMuted) return;
    for (const m of legalMoves(from)) {
      let r;
      try {
        r = applyMove(from, m.uci);
      } catch {
        continue;
      }
      if (r.fen !== fen) continue;
      playMoveSound(r.check ? 'check' : r.capture ? 'capture' : 'move');
      return;
    }
  }, [fen, decorative]);
  // P4b: a fixed square edge in px, for the places a board is shown at a size
  // the column does not decide -- today's lesson card wants 120px. `size` is
  // declared here rather than on `BoardProps` in `types.ts` because it is a
  // presentational affordance of this component, not part of the board
  // contract every caller reads. A sized board drops the coordinate rail and
  // the gutter pull with it: at 120px a 15px rank glyph is a third of a square
  // and the rail stops being an index and becomes noise. Everything the rail
  // was covering for is still said -- `describeSquare` announces every
  // coordinate through the live region below, which is the path that actually
  // carries coordinates to assistive technology (§4).
  const compact = size !== undefined;
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

  // --- D1: the refutation replay -------------------------------------------
  // `step` is the index of the frame on screen, or null when the board is
  // showing the caller's own position. Everything below reads it; nothing
  // outside this component can.
  const frames = useMemo(() => replayFrames(replay), [replay]);
  const san = replay?.san ?? '';
  const [step, setStep] = useState<number | null>(() => openingStep(frames));
  const timers = useRef<number[]>([]);
  const stopTimers = useCallback(() => {
    for (const id of timers.current) clearTimeout(id);
    timers.current = [];
  }, []);
  const skipReplay = useCallback(() => {
    stopTimers();
    setStep(null);
  }, [stopTimers]);

  // The frame the replay opens on is chosen during render, not in an effect:
  // a setState in an effect body is lint-banned here (the same rule the
  // orientation reset above answers the same way), and it would also render one
  // frame of the caller's position before the replay took over.
  const [prevFrames, setPrevFrames] = useState(frames);
  if (prevFrames !== frames) {
    setPrevFrames(frames);
    setStep(openingStep(frames));
  }

  // The effect owns only the clock. Every setState below happens in a timer
  // callback, which is an external system reporting back, not a cascade.
  useEffect(() => {
    if (!frames) return;
    const reduced = prefersReducedMotion();
    const last = frames.fens.length - 1;
    // Reduced motion lands on the final frame immediately; the travel is what
    // the preference asks to remove, and it is the only thing removed.
    const arrival = reduced ? 0 : REPLAY_STEP_MS * last;
    const ids: number[] = [];
    if (!reduced) {
      for (let i = 1; i <= last; i++) ids.push(window.setTimeout(() => { setStep(i); }, REPLAY_STEP_MS * i));
    }
    // The SAN announcement is the accessible carrier and it fires on both
    // paths, at the moment the marked position is on screen.
    ids.push(
      window.setTimeout(() => {
        setStatus(`Replay: ${san}. ${replay?.note ?? 'Your position is back — try again.'}`);
      }, arrival),
    );
    ids.push(window.setTimeout(() => { setStep(null); }, arrival + (reduced ? REPLAY_HOLD_REDUCED_MS : REPLAY_HOLD_MS)));
    timers.current = ids;
    return () => {
      for (const id of ids) clearTimeout(id);
      timers.current = [];
    };
  }, [frames, san]);

  const replaying = step !== null;
  const shownFen = replaying && frames ? (frames.fens[step] ?? fen) : fen;
  const finalFrame = replaying && frames ? step === frames.fens.length - 1 : false;

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
      // Touching the board during a replay skips it rather than acting: the
      // position on screen is not the learner's, so acting on it would be a
      // move made against a board they are not looking at.
      if (replaying) { skipReplay(); return; }
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
    [disabled, mode, selected, fen, tryMove, onSelectSquare, replaying, skipReplay],
  );

  const { cursor, onKeyDown: onBoardKeyDown } = useBoardA11y(orientation, activate);
  // Whether the keyboard cursor should be PAINTED. See `squareStyles` below:
  // the cursor position is always tracked, its ring is only drawn while the
  // board holds keyboard focus.
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  // Any key ends the replay, not only the ones that would have acted: a
  // keyboard learner pressing an arrow is telling the board they are done
  // watching, and the cursor must not be moved across a position that is about
  // to be replaced.
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (replaying) { skipReplay(); return; }
      onBoardKeyDown(e);
    },
    [replaying, skipReplay, onBoardKeyDown],
  );

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
      // A typed move ENDS the replay and is then played. The text field is not
      // the board: typing into it is a deliberate answer, not "stop watching",
      // and swallowing it would silently discard an answer the learner
      // believes they gave. (Board taps are the other case and are handled the
      // other way -- see `activate`.)
      if (replaying) skipReplay();
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
    [fen, mode, disabled, onMove, onSelectSquare, replaying, skipReplay],
  );

  const { palette } = useBoardPalette();

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
    // During a replay the board is telling one story and nothing else. The
    // challenge's own highlights, the selection and the keyboard cursor all
    // belong to the learner's position, which is not the one on screen; the
    // only mark is the hatch on the square the refuting move lands on, and it
    // arrives with that move rather than before it.
    if (replaying) {
      if (finalFrame && frames) s[frames.to] = { ...styles.danger };
      return s;
    }
    for (const [sq, kind] of Object.entries(highlights)) if (kind) s[sq] = { ...styles[kind] };
    if (selected) s[selected] = { ...(s[selected] ?? {}), ...styles.selected };
    // The cursor is painted only where it can be MOVED, and only while the
    // board actually HAS keyboard focus.
    //
    // `interactive` alone was not enough. It is false only for the decorative
    // thumbnail, so every other board -- including a `mode="static"` card
    // diagram that exists to be looked at -- painted a 3px ring on a1 from the
    // moment it mounted, with nothing focused and nothing highlighted. A ring
    // on a board no one is driving is not a cursor: it reads as a selected
    // square, or as a stray defect, which is exactly how it was reported.
    //
    // The cursor is a focus indicator, so it obeys the focus rules the
    // container already obeys: it appears when the board is entered from the
    // keyboard (`:focus-visible`, the same predicate as the container's own
    // focus ring) and goes away on blur. A keyboard user still gets a visible,
    // movable cursor on a static board -- which is the behaviour the earlier
    // pass added and this keeps -- and a reader who never touches the board
    // never sees a mark that means nothing to them.
    if (interactive && keyboardFocus) {
      s[cursor] = { ...(s[cursor] ?? {}), outline: `3px solid ${inkOn(cursor)}`, outlineOffset: '-3px' };
    }
    return s;
  }, [highlights, selected, cursor, palette, inkOn, replaying, finalFrame, frames, interactive, keyboardFocus]);

  // The piece rule (DESIGN-SYSTEM.md 3.1): every piece is a fill plus a 1.5px
  // outline in the OPPOSING piece colour, and max(fill, outline) must clear 3:1
  // on both squares. react-chessboard lets the fill be set per piece but hard
  // codes the outline to #000000 for both colours, which is only the opposing
  // colour for white pieces. Measured, that fails exactly one combination: a
  // dark piece on --board-dark in the DARK appearance was fill 2.21 and outline
  // 2.60, and a scoped stroke override existed here to fix it. With the dark
  // theme gone (NEUMORPHIC-DELTA.md 4) that combination no longer exists: in
  // the one appearance the app ships, the dark fill measures 5.00 on
  // --board-dark and 13.58 on --board-light, so the library's #000000 stroke is
  // never load-bearing and the override is removed rather than left inert.
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
      position: shownFen,
      boardOrientation: orientation === 'w' ? ('white' as const) : ('black' as const),
      allowDragging: mode === 'play' && !disabled && !replaying,
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
      // The arrow names the same move the replay plays. Showing it before the
      // piece has moved would spoil the one thing the replay exists to show,
      // so it joins the final frame and then stays, exactly as it did before
      // D1 existed -- F-PA-6 is not regressed, it is preceded.
      arrows: (replaying && !finalFrame ? [] : arrows).map((a) => ({
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
    [shownFen, orientation, mode, disabled, squareStyles, arrows, tryMove, activate, onDragStart, onDragEnd, palette, pieces, replaying, finalFrame],
  );

  return (
    <div
      className="w-full"
      data-board-root
      data-testid={testId}
      data-fen={fen}
      aria-hidden={decorative ? true : undefined}
      data-replaying={replaying ? 'true' : undefined}
      // Δ1 rule 4 -- ELEVATION STOPS AT THE BOARD'S EDGE. There is no
      // `box-shadow`, no `border-radius`, no border and no key edge here, on
      // the grid below it, on the squares, or on the marks, and there must
      // never be one. Both references frame their
      // board with literally nothing (PREMIUM-DELTA §1.1: chess.com's hero
      // board reads `box-shadow: none`, `border: 0px none`), and the first
      // draft of the delta's own sunken well was cut in self-critique for
      // contradicting them. The board's presence is arithmetic -- its share of
      // the viewport and the parity of the column beside it -- not framing.
      // `Board.test.tsx` asserts this; the inset ring on a `good` mark is a
      // mark INSIDE a square, not elevation under the board, which is why the
      // assertion is written against the container and not against
      // `highlightStyles`.
      style={compact ? { width: size, maxWidth: '100%' } : undefined}
    >
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
        className="relative grid"
        style={
          compact
            ? { gridTemplateColumns: 'minmax(0, 1fr)' }
            : {
                gridTemplateColumns: `${String(RAIL_REM)}rem minmax(0, 1fr)`,
                marginLeft: `-${String(RAIL_REM)}rem`,
              }
        }
      >
        {!compact && <CoordinateRail axis="rank" items={railRanks(orientation)} />}
        <div
          ref={appRef}
          role={interactive ? 'application' : undefined}
          aria-label={
            interactive ? `Chess board, ${orientation === 'w' ? 'white' : 'black'} at the bottom` : undefined
          }
          tabIndex={interactive ? 0 : undefined}
          onKeyDown={interactive ? onKeyDown : undefined}
          onFocus={
            interactive
              ? (e) => {
                  // `:focus-visible` is the browser's own answer to "did this
                  // focus come from the keyboard?", and it is the predicate the
                  // container's focus ring already uses. Matching it keeps the
                  // square cursor and the container ring appearing together
                  // rather than one arriving on a tap and the other not.
                  setKeyboardFocus(e.currentTarget.matches(':focus-visible'));
                }
              : undefined
          }
          onBlur={interactive ? () => { setKeyboardFocus(false); } : undefined}
          className={
            interactive
              ? 'w-full touch-none outline-none focus-visible:ring-2 focus-visible:ring-accent'
              : 'w-full touch-none'
          }
        >
          <Chessboard options={options} />
        </div>
        {!compact && (
          <>
            <div />
            <CoordinateRail axis="file" items={railFiles(orientation)} />
          </>
        )}
        {/*
          The way out of the replay, for the duration of the replay. It overlays
          the board itself -- the positioned ancestor is this grid, not the whole
          component, so it never lands on the move field below -- which keeps the
          page from reflowing twice in 1.2 seconds; the board is non-interactive
          for that window anyway. `tap` gives it the 44px minimum and it takes
          the standard focus ring. `progress-indicators.md > Best practices`:
          "when it's feasible, let people halt processing" -- skipping costs
          nothing here, because the marked square, the arrow and the coach's line
          all survive it.
        */}
        {replaying && (
          <button
            type="button"
            data-replay-skip
            onClick={skipReplay}
            // The border is `--content`, not `--edge-strong`. This is the one
            // control in the app that sits ON the board, so its boundary is
            // measured against the squares rather than a page surface, and
            // `--edge-strong` fails there: 3.66 on --board-light but 1.35 on
            // --board-dark, and the control can overlap either, so it misses
            // the 3:1 that `accessibility.md > Color and effects` wants for a
            // non-text boundary. The two ratios stated
            // here were the OLD --content against the OLD squares; re-measured
            // for the shipped palette (#0f172b on #e9e1d2 / #94876f) they are
            // 13.73 and 5.06, both clear.
            //
            // It takes NO shadow, and that is the one deliberate exception to
            // chunk N4's "every control is raised": PREMIUM-DELTA.md Δ1 rule 4
            // stops elevation at the board's edge and this control is inside
            // it. `controls.spec.ts` therefore requires a 3:1 border of every
            // control and a raise of none — the border is the rule, the raise
            // is the house style.
            className="tap t-label absolute right-2 bottom-8 z-10 rounded-control border border-content bg-surface-raised px-4 text-content"
          >
            Skip
          </button>
        )}
      </div>
      {interactive && (
        <p role="status" aria-live="polite" aria-label="Board announcements" className="sr-only">{announce ?? status}</p>
      )}
      {interactive && textEntry && <TextMoveEntry onSubmit={onText} />}
    </div>
  );
}
