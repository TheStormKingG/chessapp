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

      {/*
        NEUMORPHIC-DELTA.md §6 / chunk N2. This is a CONTAINER, not a control:
        nothing in it receives a press, so it takes the soft raise and nothing
        else. Three things changed together and each is the same rule.

          - The `border-b-2 border-b-key-raised` bottom edge is gone. A card
            carrying a soft neumorphic raise AND a crisp solid bottom border is
            running two depth grammars at once; §6 keeps one per element class.
          - The 1px `--edge-strong` ring is gone too. `theme.css` states the
            rule for `--surface-raised` exactly: the boundary is the shadow
            pair, "or --edge-strong where the element is a control". A 3.76:1
            control border on a non-interactive panel is the same two-grammar
            mistake with a thinner line, and it paints "press me" on a thing
            that cannot be pressed.
          - `--radius-card` (16px) replaces `rounded-xl`, which is the CONTROL
            radius (12px). Card scale for a card (§3.5).

        Nothing that was doing contrast work has been removed: the ring was not
        a state, not a boundary between two interactive things, and carried no
        meaning colour-only or otherwise. What bounds the card now is the
        `--shadow-raised` pair over the 1.19:1 lift of `--surface-raised` — what
        the reference does on every panel it ships (measured: every preqal.org
        panel computes `border-width: 0px`). The two segmented controls and the
        Start button below keep their `--edge-strong` edges, because those ARE
        controls and §3.3 is unconditional about them.
      */}
      <div className="n-panel n-edge mt-4 flex gap-3 rounded-card bg-panel p-3">
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
          entirely from its edge.

          NEUMORPHIC-DELTA.md §6 / chunk N2 moves that edge from a ring to a GROOVE, and
          the reason is the same one that took the ring off the card around it. Per
          §3.1 `--edge-strong` is "every control border": on an `aria-hidden` shape that
          receives nothing, a control border is a painted affordance for an interaction
          that does not exist -- observation 0118's failure, where a decorative variant
          drops the ARIA and keeps the paint. The disc is now cut into the card with
          `--shadow-inset-soft`, which is the grammar this system gives a recessed thing,
          and it reads as a stamped shape rather than a button. The card's own raise and
          the disc's groove are then one grammar with two signs, not two grammars.

          Measured in the browser, light only -- the dark figures this comment used to
          carry are gone with the appearance (§4), and these are re-derived rather than
          re-copied (observation 0113): the monogram is `--content` #0F172B on
          `--surface-raised` #F6F8FA at **16.75:1**, far past the 4.5 it needs. The
          groove carries no contrast duty: `--n-dark` is 1.72:1 and `--n-light` 1.27:1,
          decorative by construction, which is exactly why nothing is allowed to depend
          on it. Nothing here was ever carried by colour alone -- the letter is
          decoration, the name is spelled out beside it -- so nothing is lost.
        */}
        <div
          aria-hidden
          className="t-title n-inset-soft flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface-raised"
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
