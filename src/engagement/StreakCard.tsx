import { plural } from '@/app/plural';
import { MILESTONES, type Streak } from './streak';

/**
 * F-EN-1's streak, on Today.
 *
 * ── THE HOUSE IDIOM, NOT A NEW ONE ───────────────────────────────────────────
 *
 * DESIGN-SYSTEM.md §3.2 defines `index` as the face for "counters, clock, rating,
 * XP, move numbers", and Today already spends `t-index` on the XP line under its
 * `display-lg` title. A streak is a counter, so it is an `index` line in the same
 * place and the same voice — not a badge, not a flame, not a pill. §3.3's 999px
 * clause rules out a chip, and NEUMORPHIC §7.3 allows one hero element per screen,
 * which Today has already spent on the lesson board.
 *
 * The status line beneath it is `t-label` in `--content-dim`, which is the pairing
 * the unit meter and the resume hint already use.
 *
 * ── WHAT IS SAID IN WORDS ────────────────────────────────────────────────────
 *
 * Every state is stated in words and never in colour alone: a paused streak says
 * it is paused and says the day it would end, a held freeze is a count, and a
 * milestone is a sentence. There is no icon carrying meaning, so nothing here
 * needs a second channel for forced colours or a screen reader.
 *
 * ── AND WHAT IS NOT SAID ─────────────────────────────────────────────────────
 *
 * No days-missed count, and nothing that frames a paused streak as a failure —
 * the same content constraint F-EN-7 states for the reminder copy, which a screen
 * the learner opens every day has at least as much reason to honour.
 */
export function StreakCard({ streak }: { streak: Streak }) {
  if (streak.days === 0) {
    return (
      <p className="t-label mt-1 text-content-dim">
        {/* Nothing to lose yet, so nothing is dressed up as a loss. */}
        Do one thing today and your streak starts.
      </p>
    );
  }

  return (
    <div className="mt-1">
      <p className="t-index text-content-dim" data-testid="streak-days">
        {plural(streak.days, 'day')} in a row
        {streak.freezes > 0 && (
          <>
            {'  ·  '}
            {plural(streak.freezes, 'freeze')} held
          </>
        )}
      </p>
      <p className="t-label text-content-dim" role="status" data-testid="streak-status">
        {statusLine(streak)}
      </p>
      {streak.milestoneToday !== null && (
        /*
         * F-EN-1's milestone. "Their own animation and a shareable card" is the
         * requirement; the ANIMATION and the SHARE CARD are not built — an
         * animation belongs with the celebration work PRD 8.2's F-HM-4 owns, and a
         * shareable card needs an image renderer and a share target. This is the
         * milestone STATED, which is the part that runs in a browser today.
         */
        <p className="t-heading mt-2 rounded-card bg-accent-soft p-3" data-testid="streak-milestone">
          {streak.milestoneToday} days. That is the {ordinal(streak.milestoneToday)} milestone.
        </p>
      )}
    </div>
  );
}

function statusLine(s: Streak): string {
  switch (s.status) {
    case 'extended-today':
      return s.nextMilestone === null
        ? 'Today is counted.'
        : `Today is counted. ${String(s.nextMilestone - s.days)} more to ${String(s.nextMilestone)} days.`;
    case 'at-risk':
      return 'One lesson, five puzzles or a game review keeps it going.';
    case 'paused':
      // Says what saves it and by when. No count of the days already missed.
      return `Paused. Anything up to the end of ${s.loseAtEndOf ?? 'today'} keeps it.`;
    case 'none':
      return 'Do one thing today and your streak starts.';
  }
}

/** Which of F-EN-1's eight milestones this is, in words. */
function ordinal(days: number): string {
  const names = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];
  const i = MILESTONES.indexOf(days as (typeof MILESTONES)[number]);
  return names[i] ?? 'next';
}
