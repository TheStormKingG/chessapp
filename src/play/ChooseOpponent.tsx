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

      <div className="mt-4 flex gap-3 rounded-xl border border-edge-strong border-b-2 border-b-key-raised bg-surface-raised p-3">
        {/*
          A monogram, not an avatar image: no persona art is shipped, and a root-relative
          path would miss under the production base anyway. Swap it for an <img> when the
          artwork lands.

          PREMIUM-DELTA §5, "and one thing to remove": `--accent-soft` was doing five
          different jobs, which is the exact failure DESIGN-SYSTEM.md §3.1 built the
          palette to avoid. It keeps ONE -- the selected segment of the two segmented
          controls below, where a tint is the conventional affordance for "this is the
          chosen one". Here it was carrying no meaning at all: the disc is not selected,
          not accented and not a state, it is a shape holding a letter. So the tint goes
          and the disc is drawn the way the delta specifies -- `--surface-raised` with a
          1px `--edge-strong` ring. The disc then matches the card it sits on and is read
          entirely from its edge, which is the same key-edge grammar Δ1 gave every other
          raised thing. Measured in the browser, both appearances: the ring is 3.99:1
          light / 3.59:1 dark against `--surface-raised`, clear of the 3:1 a non-text
          boundary needs; the monogram is `--content` at 16.28:1 light / 13.71:1 dark.
          Nothing here was ever carried by colour alone -- the letter is the content and
          the name is spelled out beside it -- so nothing is lost with the tint.
        */}
        <div
          aria-hidden
          className="t-title flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-edge-strong bg-surface-raised"
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
        <div className="mt-2 flex flex-wrap gap-2">
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
        <div className="mt-2 flex flex-wrap gap-2">
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
