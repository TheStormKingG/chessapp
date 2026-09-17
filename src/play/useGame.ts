import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getEngine } from '@/engine';
import { reportError, track } from '@/analytics';
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

export function useGame(o: { learner: 'w' | 'b'; timeControl: TimeControl; coach: boolean }): UseGame {
  const coachMuted = useSettings((s) => s.coachMuted);
  const append = useProgress((s) => s.append);
  const [g, setG] = useState<GameState>(() => initGame({ ...o, persona: ROSA.id }));
  const [coachText, setCoachText] = useState<string | null>(null);
  const [tone, setTone] = useState<'good' | 'bad' | 'neutral'>('neutral');
  const [thinking, setThinking] = useState(false);
  const [engineDown, setEngineDown] = useState(false);

  const coach = useMemo(() => {
    const c = new CoachService();
    c.muted = coachMuted || !o.coach;
    return c;
  }, [coachMuted, o.coach]);
  const bot = useMemo(() => new BotService(ROSA, getEngine()), []);

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
        reportError(e, { where: 'play-bot-move' });
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

  // The bot opens when the learner is Black. Guarded by a ref rather than by the move count,
  // so a take-back to the start cannot make it fire a second time.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || g.learner !== 'b' || g.history.length > 1) return;
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
          reportError(e, { where: 'play-hint' });
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
      setG((s) => showThreats(s));
    },
    undo: () => {
      setG((s) => takeBack(s));
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
