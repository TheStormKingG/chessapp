import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Board } from '@/board';
import { CoachBubble } from '@/coach';
import { getEngine } from '@/engine';
import { useSettings } from '@/app/settings';
import type { Color } from '@/rules';
import { useGame } from './useGame';
import { EngineGate } from './EngineGate';
import { engineIsReady } from './engineReady';
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

/**
 * Wireframe 13. The engine is fetched before the game mounts (F-OF-2), so the
 * bot never has to move a board that has no engine behind it — and `ChooseOpponent`
 * stays free of the download, which only matters once a game actually starts.
 */
export function PlayScreen() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const learner: Color = params.get('color') === 'b' ? 'b' : 'w';
  const timeControl: TimeControl = params.get('tc') === '10+0' ? '10+0' : 'untimed';
  const coachOn = params.get('coach') !== '0';
  /* The game is a modal task now (chunk B1), so the tab bar is no longer the way
     out of it — and the longest wait in the app happens before `PlayGame` mounts
     and can offer its own ✕. This is that wait's dismiss control: nothing has
     started yet, so it leaves without asking. It is gone the moment the game's
     own header is on screen, so there is never a second ✕. */
  const [ready, setReady] = useState(engineIsReady);

  return (
    <>
      {!ready && (
        <div className="px-4 pt-4">
          <button
            type="button"
            className="tap"
            aria-label="Exit game"
            onClick={() => {
              void nav('/play');
            }}
          >
            ✕
          </button>
        </div>
      )}
      <EngineGate
        onReady={() => {
          setReady(true);
        }}
      >
        <PlayGame learner={learner} timeControl={timeControl} coach={coachOn} />
      </EngineGate>
    </>
  );
}

function PlayGame({ learner, timeControl, coach: coachOn }: { learner: Color; timeControl: TimeControl; coach: boolean }) {
  const nav = useNavigate();
  const textEntry = useSettings((s) => s.textEntry);

  const { g, persona, coachText, tone, thinking, engineDown, result, onLearnerMove, hint, threats, undo, giveUp, retryEngine } =
    useGame({ learner, timeControl, coach: coachOn });

  const over = g.over.over;
  const engine = getEngine();
  const [confirmingExit, setConfirmingExit] = useState(false);
  const leave = () => {
    void nav('/play');
  };
  /* `modality.md > Best practices`: "When necessary, help people avoid data loss
     by getting confirmation before closing a modal view." A game in progress is
     exactly that — there is no saved position to come back to — while a finished
     game has nothing left to lose, so it closes on the first press. */
  const exit = () => {
    if (over) leave();
    else setConfirmingExit(true);
  };

  return (
    // Concept Note 2 and DESIGN-SYSTEM.md §3.3: on a desktop the board sits in
    // the middle column at its natural square size and the right column carries
    // the opponent, the coach line, the controls and the game record; below `md`
    // this collapses to the single phone column, unchanged. The board column is
    // capped to the viewport height so an 800px-tall board can no longer push
    // its own top off-screen.
    <section className="p-4 md:mx-auto md:grid md:max-w-6xl md:grid-cols-[minmax(0,1fr)_22rem] md:items-start md:gap-6 md:px-6">
      <header className="flex items-baseline justify-between gap-3 md:col-span-2">
        <button
          type="button"
          className="tap self-center"
          aria-label="Exit game"
          onClick={exit}
        >
          ✕
        </button>
        <h1 className="mr-auto text-lg font-semibold">
          {persona.name} <span className="font-normal text-content-dim">· {persona.ratingBand}</span>
        </h1>
        {g.clockMs && (
          <p className="tabular-nums text-sm" aria-live="off">
            <span aria-label="Your time">{clock(g.clockMs[learner])}</span>
            <span className="text-content-dim"> / </span>
            <span aria-label={`${persona.name}'s time`}>{clock(g.clockMs[learner === 'w' ? 'b' : 'w'])}</span>
          </p>
        )}
      </header>

      {confirmingExit && (
        <div className="mt-3 rounded-lg border border-edge-strong p-4 md:col-span-2">
          <h2 className="text-lg font-semibold">Leave the game?</h2>
          <p className="mt-2 text-sm">This game is not saved, and you would start a new one.</p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="tap flex-1 rounded-lg bg-accent px-3 py-2 font-semibold text-accent-on"
              onClick={() => {
                setConfirmingExit(false);
              }}
            >
              Keep playing
            </button>
            <button type="button" className="tap flex-1 rounded-lg border border-edge-strong px-3 py-2" onClick={leave}>
              Leave
            </button>
          </div>
        </div>
      )}

      {engineDown && (
        <p role="alert" className="mt-3 md:col-span-2 rounded-lg border border-danger bg-surface-raised p-3 text-sm">
          The engine could not load on this device.{' '}
          <button type="button" onClick={retryEngine} className="min-h-11 underline">
            Retry
          </button>
        </p>
      )}

      <div className="mt-3 md:sticky md:top-4 md:mt-4">
       <div className="md:mx-auto md:max-w-[calc(100dvh-8rem)]">
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
      </div>

      <div className="md:mt-4">
        <CoachBubble text={coachText} tone={tone} />

        {!over && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={hint}
              disabled={g.turn !== learner || g.hintLevel >= 2}
              className="min-h-11 rounded-lg border border-edge-strong disabled:opacity-50"
            >
              Hint
            </button>
            <button type="button" onClick={threats} className="min-h-11 rounded-lg border border-edge-strong">
              Threats
            </button>
            <button
              type="button"
              onClick={undo}
              disabled={g.history.length < 2}
              className="min-h-11 rounded-lg border border-edge-strong disabled:opacity-50"
            >
              Take back
            </button>
            <button type="button" onClick={giveUp} className="min-h-11 rounded-lg border border-edge-strong">
              Resign
            </button>
          </div>
        )}

        {over && result && (
          <div className="mt-4 rounded-xl border border-edge-strong bg-surface-raised p-4">
            <p className="font-medium">{RESULT_LINE[result]}</p>
            {/* Crowns reward playing without help (F-PL-4), so they show on every finished game.
                The result line above leads, and on a loss the crowns read as a report. */}
            <p className="mt-1 text-sm text-content-dim">
              <span aria-label={`${crowns(g)} of 3 crowns`}>
                {'♛'.repeat(crowns(g))}
                <span className="opacity-30">{'♛'.repeat(3 - crowns(g))}</span>
              </span>{' '}
              {crownsNote(result, crowns(g))}
            </p>
            <p className="mt-1 text-sm text-content-dim">
              {g.hints} hint{g.hints === 1 ? '' : 's'}, {g.takebacks} take-back{g.takebacks === 1 ? '' : 's'}
            </p>
            <button type="button" disabled className="mt-3 min-h-11 w-full rounded-lg border border-edge-strong opacity-50">
              Review this game
            </button>
            <p className="mt-1 text-xs text-content-dim">Coming next release.</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  void nav('/play');
                }}
                className="min-h-11 flex-1 rounded-lg bg-accent px-4 font-medium text-accent-on"
              >
                Play again
              </button>
              <button
                type="button"
                onClick={() => {
                  void nav('/path');
                }}
                className="min-h-11 flex-1 rounded-lg border border-edge-strong px-4"
              >
                Back to the path
              </button>
            </div>
          </div>
        )}

        {/* The game record: the right column's content at regular width (§3.3),
            set in the index face like every other counter in the design. */}
        <ol className="mt-4 font-index text-sm tabular-nums text-content-dim">
          {pairs(g.sans).map((p) => (
            <li key={p.n}>
              {p.n}. {p.w} {p.b}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
