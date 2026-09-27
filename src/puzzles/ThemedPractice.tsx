import { useMemo, useState } from 'react';
import { btn } from '@/app/Button';
import { PuzzlePlayer } from './PuzzlePlayer';
import { THEME_DEFINITION, THEME_LABEL, THEMES } from './themes';
import type { AttemptResult, Puzzle, RatingBand, Theme } from './types';

/**
 * Themed practice (F-PZ-2, design spec §5.3).
 *
 * One or more themes and a band, no timer, and no rating impact. The
 * definitions are ChessApp's own one-sentence wording from `themes.ts`, reused
 * rather than re-worded here, so the words the learner reads are the same on
 * every screen that names a motif. What the packs were filtered on is
 * `LICHESS_TAG` — the Lichess dump's tag names — not this prose.
 *
 * **No rating impact is not a property of this screen.** It is a property of
 * the attempt: every attempt made here carries `source: 'themed'`, and the
 * projection in `src/data/reduce.ts` refuses to move the rating for one. A
 * screen that merely declined to SHOW a rating would leave the projection free
 * to move it, which is the half that matters.
 *
 * The pool is a prop, in the shape the rest of this feature uses: the screen
 * renders what it is given and the route that mounts it owns the fetch.
 */

const BANDS: readonly RatingBand[] = ['600-900', '900-1200', '1200-1500'];

/** The half-open `[min, max)` a band name states. Parsed, never re-tabulated. */
function bounds(band: RatingBand): { min: number; max: number } {
  const [min, max] = band.split('-').map(Number);
  return { min: min ?? 0, max: max ?? Infinity };
}

export function ThemedPractice({
  pool,
  onAttempt,
  initialThemes = [],
}: {
  pool: readonly Puzzle[];
  onAttempt: (r: AttemptResult) => void;
  /**
   * Themes to start with — F-PZ-2 d's lesson link arrives here, carrying a
   * theme name out of a URL. Filtered against `THEMES` rather than trusted:
   * the value is a string until this module has checked it, and an unchecked
   * one would select a theme no pack carries and offer practice with nothing
   * in it.
   */
  initialThemes?: readonly Theme[];
}) {
  const [chosen, setChosen] = useState<readonly Theme[]>(() =>
    initialThemes.filter((t) => THEMES.includes(t)),
  );
  const [band, setBand] = useState<RatingBand>('600-900');
  const [started, setStarted] = useState(false);
  const [at, setAt] = useState(0);

  const selection = useMemo(() => {
    const { min, max } = bounds(band);
    return pool.filter(
      (p) => p.rating >= min && p.rating < max && p.themes.some((t) => chosen.includes(t)),
    );
  }, [pool, band, chosen]);

  const puzzle = started ? selection[at] : undefined;

  const toggle = (theme: Theme) => {
    setChosen((cur) => (cur.includes(theme) ? cur.filter((t) => t !== theme) : [...cur, theme]));
  };

  if (started && puzzle) {
    return (
      <>
        {/* The size of the set the learner is working through. It is not a
            timer and not a rating: F-PZ-2 removes the clock, not the sense of
            where you are. */}
        <p className="sr-only" data-testid="count">
          {selection.length}
        </p>
        <PuzzlePlayer
          // Every puzzle in the run starts fresh. Without a key React reuses
          // the instance and the second puzzle opens carrying the first one's
          // hints, misses and result — the defect that shipped in the review
          // feature and that every single-item test passed through.
          key={puzzle.id}
          puzzle={puzzle}
          source="themed"
          onDone={(r) => {
            onAttempt(r);
          }}
          onExit={() => {
            if (at + 1 < selection.length) setAt(at + 1);
            else setStarted(false);
          }}
        />
      </>
    );
  }

  return (
    <section className="p-4">
      <h1 className="t-display">Themed practice</h1>
      <p className="t-body mt-2 text-content-dim">
        No timer, and nothing here moves your rating. Pick what you want to work on.
      </p>

      {/* Deliberately undecorated. This wore the same accent stripe as the
          lesson's habit and the puzzle's explanation, and it does not belong
          with them: an empty result is not a remark about the content, it is
          the content. Boxing it in an accent colour makes a perfectly normal
          answer — you picked a band with no puzzles in it — read as a fault the
          learner caused. Dim prose in the flow says the same thing without the
          alarm. */}
      {started && selection.length === 0 && (
        <p className="t-body mt-4 text-content-dim">
          No puzzles for that combination yet. Try another band, or add a theme.
        </p>
      )}

      <fieldset className="mt-6">
        <legend className="t-title">Themes</legend>
        <ul className="mt-2 flex flex-col gap-3">
          {THEMES.map((theme) => (
            <li key={theme}>
              <label className="flex gap-3">
                <input
                  type="checkbox"
                  className="mt-1 accent-accent"
                  checked={chosen.includes(theme)}
                  onChange={() => {
                    setStarted(false);
                    toggle(theme);
                  }}
                />
                <span>
                  <span className="t-body-strong block">{THEME_LABEL[theme]}</span>
                  <span className="t-body block text-content-dim">{THEME_DEFINITION[theme]}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <p className="mt-6">
        <label className="t-body-strong block" htmlFor="themed-band">
          Band
        </label>
        <select
          id="themed-band"
          className="tap mt-2 w-full rounded-control border border-edge-strong bg-surface-raised px-3 text-content"
          value={band}
          onChange={(e) => {
            setStarted(false);
            setBand(e.target.value as RatingBand);
          }}
        >
          {BANDS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </p>

      <button
        type="button"
        className={`${btn.primary} mt-6 w-full disabled:opacity-60`}
        disabled={chosen.length === 0}
        onClick={() => {
          setAt(0);
          setStarted(true);
        }}
      >
        Start practising
      </button>
    </section>
  );
}
