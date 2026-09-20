import { useState } from 'react';
import { plural } from '@/app/plural';
import { PuzzlePlayer } from './PuzzlePlayer';
import { DAILY_ATTEMPTS, dailyIndex, localDateKey } from './daily';
import type { AttemptResult, Puzzle } from './types';

/**
 * The daily puzzle (F-PZ-6, design spec §4.3).
 *
 * The same puzzle for everyone on a given day, three attempts, and a calendar
 * of the days that were solved. There is no server: the index is derived from
 * the device's own calendar date against a fixed pack, so two devices agree
 * without ever talking to each other.
 *
 * **The timezone is the device's local date, decided explicitly.** A learner's
 * "today" is their today. The consequence — two learners in different zones
 * briefly see different daily puzzles — is accepted, and is preferable to a
 * UTC rollover that changes the puzzle mid-afternoon for some learners.
 *
 * `solvedDays` comes from the event log, projected by the caller. Passing the
 * days rather than the events keeps this screen a pure render of plain data,
 * which is the shape the rest of this feature uses.
 *
 * NAMED `DailyPuzzle`, NOT `Daily`. The plan asked for `Daily.tsx` beside
 * `daily.ts`, which cannot both exist on a case-insensitive filesystem — macOS
 * and Windows both resolve `./Daily` to `daily.ts`, so the import succeeded,
 * returned a module with no component in it, and React reported an undefined
 * element type with no hint of where it came from. CI on Linux would have
 * disagreed with every developer machine.
 */
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function DailyPuzzle({
  pack,
  solvedDays,
  today = new Date(),
  onAttempt,
}: {
  pack: readonly Puzzle[];
  /** Local date keys, as `localDateKey` produces them. */
  solvedDays: readonly string[];
  today?: Date;
  onAttempt: (r: AttemptResult) => void;
}) {
  const key = localDateKey(today);
  const puzzle = pack[dailyIndex(key, pack.length)];
  const alreadySolved = solvedDays.includes(key);
  const [misses, setMisses] = useState(0);
  const [finished, setFinished] = useState(false);

  const calendar = (
    <Calendar today={today} solvedDays={solvedDays} />
  );

  if (!puzzle) {
    return (
      <section className="p-4">
        <h1 className="t-display">Daily puzzle</h1>
        {/* An empty pack is a real state — a fresh install that has not fetched
            one yet, or a band with nothing in it. It says so rather than
            presenting a board with no position on it. */}
        <p className="t-body mt-3">No daily puzzle is available yet. It arrives with the puzzle pack.</p>
        {calendar}
      </section>
    );
  }

  if (alreadySolved || finished) {
    return (
      <section className="p-4">
        <h1 className="t-display">Daily puzzle</h1>
        <p className="t-body mt-3">
          {alreadySolved
            ? 'Today’s puzzle is already solved. The next one arrives tomorrow.'
            : 'That is today’s three attempts spent. The next puzzle arrives tomorrow.'}
        </p>
        {calendar}
      </section>
    );
  }

  return (
    <>
      <p className="t-index px-4 pt-4 text-content-dim">
        {/* Stated BEFORE they are spent: a count that only appears once it
            matters is a count the learner could not plan around. */}
        {plural(DAILY_ATTEMPTS - misses, 'attempt')} left today.
      </p>
      <PuzzlePlayer
        key={`${key}:${puzzle.id}`}
        puzzle={puzzle}
        source="daily"
        maxMisses={DAILY_ATTEMPTS}
        onDone={(r) => {
          setMisses(r.misses);
          onAttempt(r);
        }}
        onMiss={setMisses}
        onExit={() => {
          setFinished(true);
        }}
      />
      {/* The run the day belongs to, kept on screen throughout rather than
          revealed at the end: F-PZ-6's calendar is the reason the daily puzzle
          is worth coming back to, and a streak you cannot see is not one. */}
      <div className="px-4 pb-4">{calendar}</div>
    </>
  );
}

/**
 * The month the learner is in, with the days they solved marked.
 *
 * Every day carries its state in WORDS through its own label, not only as a
 * glyph and a colour: the grid is read by a screen reader one cell at a time,
 * and "17" on its own says nothing about whether it was solved.
 */
function Calendar({ today, solvedDays }: { today: Date; solvedDays: readonly string[] }) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const name = `${MONTHS[month] ?? ''} ${String(year)}`;
  const solved = new Set(solvedDays);

  return (
    <>
      <h2 className="t-title mt-8" id="daily-calendar">
        {name}
      </h2>
      <ul aria-labelledby="daily-calendar" className="mt-3 grid grid-cols-7 gap-1">
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1;
          const dayKey = localDateKey(new Date(year, month, day));
          const done = solved.has(dayKey);
          return (
            <li
              key={day}
              aria-label={`${String(day)} ${MONTHS[month] ?? ''}, ${done ? 'solved' : 'not solved'}`}
              className={`t-index flex aspect-square items-center justify-center rounded-control border ${
                done ? 'border-accent text-content' : 'border-edge-strong text-content-dim'
              }`}
            >
              {/* Two channels, never colour alone (hard constraint 6): the tick
                  is the shape and the border is the ink. */}
              <span aria-hidden>{done ? '✓' : day}</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
