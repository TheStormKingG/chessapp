import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getEngine } from '@/engine';
import { reportEngineFailure, track } from '@/analytics';
import { BotService, type Persona } from '@/bot';
import { CoachService } from '@/coach';
import { useSettings } from '@/app/settings';
import { useProgress } from '@/data';
import rosa from '@content/personas/rosa.json';
import {
  applyBotMove,
  applyLearnerMove,
  coachEventFor,
  fallbackHint,
  hintCue,
  hintFromMove,
  initGame,
  preMoveEvent,
  resign,
  resultFor,
  showThreats,
  threatsCue,
  takeBack,
  tickClock,
  applyHint,
  type CoachCue,
  type GameState,
  type TimeControl,
} from './GameMachine';
import { crowns } from './crowns';

const HINT_DEPTH = 8;
const TICK_MS = 1000;

export const ROSA = rosa as Persona;

export interface UseGame {
  g: GameState;
  persona: Persona;
  coachText: string | null;
  tone: 'good' | 'bad' | 'neutral';
  thinking: boolean;
  engineDown: boolean;
  result: 'win' | 'loss' | 'draw' | null;
  onLearnerMove: (uci: string) => void;
  hint: () => void;
  threats: () => void;
  undo: () => void;
  giveUp: () => void;
  retryEngine: () => void;
}

/**
 * PRD F-TS-5's two openings onto this hook, both optional and both additive.
 *
 * `fen` starts the game from a given position ("the learner's own position a few
 * moves before the pattern arose"). `openingLine` gives the bot a line to play
 * ("the opponent plays the line the learner struggles with"): it is spliced into a
 * copy of the persona's own opening preference, which `BotService.bookMove` already
 * matches by legality rather than by move number, so a transposition does not break
 * it. The persona is otherwise unchanged — a targeted game is still a game against
 * the same character.
 */
export interface TargetedOptions {
  fen?: string;
  openingLine?: readonly string[];
}

export function useGame(
  o: { learner: 'w' | 'b'; timeControl: TimeControl; coach: boolean } & TargetedOptions,
): UseGame {
  const coachMuted = useSettings((s) => s.coachMuted);
  const append = useProgress((s) => s.append);
  const [g, setG] = useState<GameState>(() =>
    initGame({
      learner: o.learner,
      timeControl: o.timeControl,
      coach: o.coach,
      persona: ROSA.id,
      ...(o.fen === undefined ? {} : { fen: o.fen }),
    }),
  );
  const [coachText, setCoachText] = useState<string | null>(null);
  const [tone, setTone] = useState<'good' | 'bad' | 'neutral'>('neutral');
  const [thinking, setThinking] = useState(false);
  const [engineDown, setEngineDown] = useState(false);

  const coach = useMemo(() => {
    const c = new CoachService();
    c.muted = coachMuted || !o.coach;
    return c;
  }, [coachMuted, o.coach]);
  // The line is joined into a string so the memo is keyed on its VALUE: a fresh
  // array literal on every render would rebuild the bot — and with it the persona —
  // on every keystroke of the game.
  const lineKey = (o.openingLine ?? []).join(' ');
  const bot = useMemo(() => {
    const line = lineKey === '' ? null : lineKey.split(' ');
    const persona: Persona =
      line === null ? ROSA : { ...ROSA, opening: { white: line, black: line } };
    return new BotService(persona, getEngine());
  }, [lineKey]);

  /**
   * The coach speaks at most once per move (PRD F-PL-3). A template whose facts are missing
   * throws by design; staying silent is the only honest fallback, since the alternative is
   * inventing the fact (PRD F-CO-4).
   */
  const say = useCallback(
    (cue: CoachCue | null) => {
      if (!cue) return;
      try {
        const text = coach.line(cue.event, cue.facts);
        if (text) {
          setCoachText(text);
          setTone(cue.tone);
        }
      } catch {
        /* a template needed a fact we do not have: say nothing */
      }
    },
    [coach],
  );

  const botTurn = useCallback(
    async (state: GameState): Promise<GameState> => {
      if (state.over.over) return state;
      setThinking(true);
      try {
        const uci = await bot.chooseMove(state.fen);
        const next = applyBotMove(state, uci);
        setG(next);
        say(preMoveEvent(next));
        return next;
      } catch (e) {
        // F-ER-1: the screen says so and offers a retry; the sink gets the cause.
        reportEngineFailure(e, 'play-bot-move');
        setEngineDown(true);
        return state;
      } finally {
        setThinking(false);
      }
    },
    [bot, say],
  );

  // Exactly one game_finished per game, whichever path ends it — the learner's move, the
  // bot's reply, the clock or a resignation (PRD F-PL-8 feeds the review off this event).
  const finished = useRef(false);
  const finish = useCallback(
    async (state: GameState) => {
      const result = resultFor(state);
      if (!result || finished.current) return;
      finished.current = true;
      say({
        event: result === 'win' ? 'gameWon' : result === 'loss' ? 'gameLost' : 'gameDrawn',
        facts: {},
        tone: result === 'win' ? 'good' : 'neutral',
      });
      await append({
        type: 'game_finished',
        gameId: state.id,
        result,
        moves: Math.ceil(state.sans.length / 2),
        hints: state.hints,
        takebacks: state.takebacks,
        // F-PL-4 grades the help used, never the result, so a finished game always earns
        // crowns; the screen presents them differently on a loss.
        crowns: crowns(state),
        pgn: state.sans.join(' '),
      });
      // Spec 4.13. How the game went, never which game or which moves: no id,
      // no PGN, nothing that identifies the learner.
      track('game_finished', {
        persona: state.persona,
        timeControl: state.timeControl,
        coach: state.coach,
        result,
        moves: Math.ceil(state.sans.length / 2),
        hints: state.hints,
        takebacks: state.takebacks,
        crowns: crowns(state),
      });
    },
    [append, say],
  );

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void append({
      type: 'game_started',
      gameId: g.id,
      persona: ROSA.id,
      color: g.learner,
      timeControl: g.timeControl,
      coach: o.coach,
    });
    track('game_started', {
      persona: ROSA.id,
      color: g.learner,
      timeControl: g.timeControl,
      coach: o.coach,
    });
  }, [append, g.id, g.learner, g.timeControl, o.coach]);

  // The bot opens when it is the bot's turn in the starting position. Guarded by a ref
  // rather than by the move count, so a take-back to the start cannot make it fire a
  // second time.
  //
  // `g.turn !== g.learner`, not `g.learner !== 'b'`: F-TS-5 starts a game from an
  // arbitrary position, where whose move it is is a property of that position and not
  // of the learner's colour. The two agree for every game from the standard start,
  // which is why the colour test worked until now.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || g.turn === g.learner || g.history.length > 1) return;
    opened.current = true;
    void botTurn(g);
  }, [g, botTurn]);

  // Any path that ends the game funnels through here, so `finish` cannot be missed or doubled.
  const over = g.over.over;
  useEffect(() => {
    if (over) void finish(g);
  }, [over, g, finish]);

  // 10+0 only: decrement the side to move (PRD F-PL-5). The effect depends on whether there
  // is a clock at all, never on its value — `g.clockMs` is a fresh object every tick, and
  // depending on it would tear the interval down and restart it once a second.
  const timed = g.clockMs !== null;
  useEffect(() => {
    if (!timed || over) return;
    const id = setInterval(() => {
      setG((s) => tickClock(s, TICK_MS));
    }, TICK_MS);
    return () => {
      clearInterval(id);
    };
  }, [timed, over]);

  const onLearnerMove = useCallback(
    (uci: string) => {
      void (async () => {
        const before = g;
        if (before.over.over || before.turn !== before.learner) return;
        const next = applyLearnerMove(before, uci);
        setG(next);
        // Clear first: the previous line described the previous position, and leaving a hint
        // about a piece that has since moved on screen would be a stale claim.
        setCoachText(null);
        say(coachEventFor(before, uci, next.fen));
        if (next.over.over) return;
        await botTurn(next);
      })();
    },
    [g, say, botTurn],
  );

  const hint = useCallback(() => {
    void (async () => {
      if (g.over.over || g.hintLevel >= 2) return;
      let uci: string | null = null;
      try {
        uci = await getEngine().bestMove({ fen: g.fen, depth: HINT_DEPTH });
      } catch (e) {
        // F-PL-9: the game keeps working without the engine when the position itself
        // supplies a verified answer; otherwise the engine error is the honest report.
        uci = fallbackHint(g.fen);
        if (!uci) {
          reportEngineFailure(e, 'play-hint');
          setEngineDown(true);
          return;
        }
      }
      const h = hintFromMove(uci);
      const level = (g.hintLevel + 1) as 1 | 2;
      setG((s) => applyHint(s, h));
      say(hintCue(g, h, level));
    })();
  }, [g, say]);

  return {
    g,
    persona: ROSA,
    coachText,
    tone,
    thinking,
    engineDown,
    result: resultFor(g),
    onLearnerMove,
    hint,
    threats: () => {
      // Cue computed from `g` and spoken outside the updater, the shape `hint`
      // uses: a state updater may run twice under StrictMode and the coach must
      // not speak twice for one tap.
      setG((s) => showThreats(s));
      say(threatsCue(g));
    },
    undo: () => {
      // `takeBack` returns the SAME state when there is nothing to take back, and
      // that distinction has to be kept: silencing the coach on a no-op would be
      // a second defect in the shape of a fix.
      const next = takeBack(g);
      if (next === g) return;
      setG(next);
      // `takeBack` clears the arrows, the highlights and the hint level, because
      // they all described a position that no longer exists. The coach's line
      // described it too, and it lives in React state rather than in GameState,
      // so it was the one thing left standing -- a comment about a move the
      // learner has just withdrawn. F-CO-4 says the coach never says a word it
      // has not verified, and after a take-back this one is no longer verified.
      setCoachText(null);
      setTone('neutral');
    },
    giveUp: () => {
      setG((s) => resign(s));
    },
    retryEngine: () => {
      setEngineDown(false);
      void botTurn(g);
    },
  };
}
