import { useState } from 'react';
import { useNavigate } from 'react-router';
import { btn } from '@/app/Button';
import type { Persona } from '@/bot';
import rosa from '@content/personas/rosa.json';
import type { TimeControl } from './GameMachine';

const ROSA = rosa as Persona;

type ColourChoice = 'w' | 'b' | 'random';

/** Wireframe 12: pick the opponent, the coach, the clock and a colour, then start. */
export function ChooseOpponent() {
  const nav = useNavigate();
  const [coach, setCoach] = useState(true);
  const [tc, setTc] = useState<TimeControl>('untimed');
  const [colour, setColour] = useState<ColourChoice>('w');

  const start = () => {
    const resolved = colour === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : colour;
    void nav(`/play/game?tc=${encodeURIComponent(tc)}&color=${resolved}&coach=${coach ? '1' : '0'}`);
  };

  return (
    <section className="p-4">
      <h1 className="t-display">Play a game</h1>

      <div className="mt-4 flex gap-3 rounded-xl border border-edge-strong bg-surface-raised p-3">
        {/*
          A monogram, not an avatar image: no persona art is shipped, and a root-relative
          path would miss under the production base anyway. Swap it for an <img> when the
          artwork lands.
        */}
        <div
          aria-hidden
          className="t-title flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-soft"
        >
          {ROSA.name.slice(0, 1)}
        </div>
        <div>
          <h2 className="t-heading">
            {ROSA.name} <span className="text-content-dim">· {ROSA.ratingBand}</span>
          </h2>
          <p className="t-label mt-1 text-content-dim">{ROSA.bio}</p>
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className="t-label">Time</legend>
        <div className="mt-2 flex gap-2">
          {(['untimed', '10+0'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={tc === v}
              onClick={() => {
                setTc(v);
              }}
              className={`${btn.secondary} ${tc === v ? 'border-accent bg-accent-soft' : ''}`}
            >
              {v === 'untimed' ? 'Untimed' : '10 + 0'}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="t-label">Your colour</legend>
        <div className="mt-2 flex gap-2">
          {(
            [
              ['w', 'White'],
              ['b', 'Black'],
              ['random', 'Random'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              aria-pressed={colour === v}
              onClick={() => {
                setColour(v);
              }}
              className={`${btn.secondary} ${colour === v ? 'border-accent bg-accent-soft' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="mt-5 flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          checked={coach}
          onChange={(e) => {
            setCoach(e.target.checked);
          }}
          className="size-7 shrink-0 accent-accent focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        <span>
          Coach mode
          <span className="t-label block text-content-dim">
            A short comment on your moves, hints when you ask, and take-backs.
          </span>
        </span>
      </label>

      <button
        type="button"
        onClick={start}
        className={`${btn.primary} mt-6 w-full`}
      >
        Start game
      </button>
    </section>
  );
}
