import { useNavigate, useSearchParams } from 'react-router';
import { Board } from '@/board';
import { CoachBubble } from '@/coach';
import { getEngine } from '@/engine';
import { useSettings } from '@/app/settings';
import type { Color } from '@/rules';
import { useGame } from './useGame';
import { crowns, crownsNote } from './crowns';
import type { TimeControl } from './GameMachine';

function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function pairs(sans: string[]): { n: number; w: string; b: string }[] {
  const out: { n: number; w: string; b: string }[] = [];
  for (let i = 0; i < sans.length; i += 2) out.push({ n: i / 2 + 1, w: sans[i] ?? '', b: sans[i + 1] ?? '' });
  return out;
}

const RESULT_LINE = {
  win: 'You won.',
  loss: 'You lost this one.',
  draw: 'A draw.',
} as const;

/** Wireframe 13: the board, the coach, and the four controls. */
export function PlayScreen() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const textEntry = useSettings((s) => s.textEntry);
  const learner: Color = params.get('color') === 'b' ? 'b' : 'w';
  const timeControl: TimeControl = params.get('tc') === '10+0' ? '10+0' : 'untimed';
  const coachOn = params.get('coach') !== '0';

  const { g, persona, coachText, tone, thinking, engineDown, result, onLearnerMove, hint, threats, undo, giveUp, retryEngine } =
    useGame({ learner, timeControl, coach: coachOn });

  const over = g.over.over;
  const engine = getEngine();

  return (
    <section className="p-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold">
          {persona.name} <span className="font-normal text-ink-muted">· {persona.ratingBand}</span>
        </h1>
        {g.clockMs && (
          <p className="tabular-nums text-sm" aria-live="off">
            <span aria-label="Your time">{clock(g.clockMs[learner])}</span>
            <span className="text-ink-muted"> / </span>
            <span aria-label={`${persona.name}'s time`}>{clock(g.clockMs[learner === 'w' ? 'b' : 'w'])}</span>
          </p>
        )}
      </header>

      {engineDown && (
        <p role="alert" className="mt-3 rounded-lg border border-danger bg-card p-3 text-sm">
          The engine could not load on this device.{' '}
          <button type="button" onClick={retryEngine} className="min-h-11 underline">
            Retry
          </button>
        </p>
      )}

      <div className="mt-3">
        <Board
          fen={g.fen}
          orientation={learner}
          mode="play"
          disabled={over || thinking || g.turn !== learner}
          textEntry={textEntry}
          highlights={g.highlights}
          arrows={g.arrows}
          announce={thinking ? `${persona.name} is thinking` : undefined}
          onMove={(m) => {
            onLearnerMove(m.uci);
          }}
          // The engine must not compete with the drag for the main thread (7.6 performance).
          onDragStart={() => {
            engine.pause();
          }}
          onDragEnd={() => {
            engine.resume();
          }}
        />
      </div>

      <CoachBubble text={coachText} tone={tone} />

      {!over && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={hint}
            disabled={g.turn !== learner || g.hintLevel >= 2}
            className="min-h-11 rounded-lg border border-line disabled:opacity-50"
          >
            Hint
          </button>
          <button type="button" onClick={threats} className="min-h-11 rounded-lg border border-line">
            Threats
          </button>
          <button
            type="button"
            onClick={undo}
            disabled={g.history.length < 2}
            className="min-h-11 rounded-lg border border-line disabled:opacity-50"
          >
            Take back
          </button>
          <button type="button" onClick={giveUp} className="min-h-11 rounded-lg border border-line">
            Resign
          </button>
        </div>
      )}

      {over && result && (
        <div className="mt-4 rounded-xl border border-line bg-card p-4">
          <p className="font-medium">{RESULT_LINE[result]}</p>
          {/* Crowns reward playing without help (F-PL-4), so they show on every finished game.
              The result line above leads, and on a loss the crowns read as a report. */}
          <p className="mt-1 text-sm text-ink-muted">
            <span aria-label={`${crowns(g)} of 3 crowns`}>
              {'♛'.repeat(crowns(g))}
              <span className="opacity-30">{'♛'.repeat(3 - crowns(g))}</span>
            </span>{' '}
            {crownsNote(result, crowns(g))}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {g.hints} hint{g.hints === 1 ? '' : 's'}, {g.takebacks} take-back{g.takebacks === 1 ? '' : 's'}
          </p>
          <button type="button" disabled className="mt-3 min-h-11 w-full rounded-lg border border-line opacity-50">
            Review this game
          </button>
          <p className="mt-1 text-xs text-ink-muted">Coming next release.</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                void nav('/play');
              }}
              className="min-h-11 flex-1 rounded-lg bg-accent px-4 font-medium text-white"
            >
              Play again
            </button>
            <button
              type="button"
              onClick={() => {
                void nav('/path');
              }}
              className="min-h-11 flex-1 rounded-lg border border-line px-4"
            >
              Back to the path
            </button>
          </div>
        </div>
      )}

      <ol className="mt-4 text-sm tabular-nums text-ink-muted">
        {pairs(g.sans).map((p) => (
          <li key={p.n}>
            {p.n}. {p.w} {p.b}
          </li>
        ))}
      </ol>
    </section>
  );
}
