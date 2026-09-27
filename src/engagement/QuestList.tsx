import type { DayQuests, WeeklyQuest } from './quests';

/**
 * F-EN-3's three daily quests and the weekly one, on Today.
 *
 * ── THE IDIOM IS THE UNIT METER, WHICH TODAY ALREADY HAS ─────────────────────
 *
 * Today's "N of M lessons done" is a `t-index` count over a 2px track in
 * `--track` with an `--accent` fill, `aria-hidden`, with the count stated in words
 * above it (`screens/TodayScreen.tsx`). A quest is the same object — a count
 * against a target — so it wears the same clothes rather than arriving as a card, a
 * chip or a checkbox. Nothing here is a new visual pattern.
 *
 * The section is a `t-caption uppercase` label over a bordered list, which is
 * exactly Today's own "Up next" and "Recently finished" treatment.
 *
 * ── COMPLETION IS A WORD, NOT A TICK ─────────────────────────────────────────
 *
 * A done quest says "done" in the index line. A glyph would be meaning carried in
 * a symbol, and the meter beside it is decoration by construction.
 */
export function QuestList({ quests, weekly }: { quests: DayQuests; weekly: WeeklyQuest }) {
  return (
    <section aria-label="Today's quests" className="mt-8">
      <h2 className="t-caption uppercase tracking-wide text-content-dim">Quests</h2>
      <ul className="mt-2 rounded-card border border-edge bg-surface-raised">
        {quests.quests.map((q) => (
          <li key={q.id} className="border-b border-edge px-3 py-3 last:border-b-0" data-testid={`quest-${q.id}`}>
            <p className="t-label">{q.title}</p>
            <p className="t-index text-content-dim">
              {q.done ? 'done' : `${String(q.progress)} of ${String(q.target)}`}
            </p>
            <Meter value={q.progress} max={q.target} />
          </li>
        ))}
        <li className="border-t border-edge px-3 py-3" data-testid="quest-weekly">
          <p className="t-label">Five daily plans this week</p>
          <p className="t-index text-content-dim">
            {weekly.done
              ? 'done, a streak freeze earned'
              : `${String(weekly.progress)} of ${String(weekly.target)} · a streak freeze`}
          </p>
          <Meter value={weekly.progress} max={weekly.target} />
        </li>
      </ul>
      {quests.allThreeDone && (
        <p className="t-label mt-2 text-content-dim" role="status">
          All three done today. That is a bonus toward the next board or piece set.
        </p>
      )}
    </section>
  );
}

/**
 * Today's own meter, lifted verbatim: `h-2`, `--track` under `--accent`,
 * `aria-hidden` because the count above it is what a reader hears.
 */
function Meter({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.round((Math.min(value, max) / max) * 100);
  return (
    <div aria-hidden="true" className="n-inset-soft n-lit-sunken mt-2 h-2 w-full rounded-control bg-track">
      <div className="n-lit h-2 rounded-control bg-accent" style={{ width: `${String(pct)}%` }} />
    </div>
  );
}
