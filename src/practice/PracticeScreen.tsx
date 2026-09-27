import { Link } from 'react-router';
import { plural } from '@/app/plural';
import { VISION_MODES, MODE_TITLE } from '@/vision/types';
import { DRILLS } from './drills';

/**
 * The Practice tab (PRD §8.7, F-PR-1 and F-PR-3).
 *
 * ── WHY THIS REPLACED THE PUZZLES TAB RATHER THAN BECOMING A SIXTH ───────────
 *
 * The shell had five tabs and one of them was `Puzzles`, pointing at a home whose
 * four entries were the rated stream, themed practice, the daily puzzle and
 * fix-my-mistakes. F-PR-1 asks for a Practice tab; F-PR-3 asks that the review
 * queue and fix-my-mistakes be reachable from it. Practice is the more general
 * thing and puzzles are one kind of practice, so a sixth tab would have put
 * "Puzzles" and "Practice" beside each other with the first a subset of the
 * second — and at 390 px a sixth tab takes the labels below the readable size the
 * tab bar is built for.
 *
 * So the TAB is Practice, at `/practice`, and `/puzzles` is unchanged and still
 * routed: every deep link into it keeps working, `PuzzlesScreen` and its tests are
 * untouched, and the puzzles home is now reached from here. Nothing was deleted.
 *
 * ── THE SCREEN IS STATIC, AND MUST STAY THAT WAY ────────────────────────────
 *
 * It is a tab, so it is on the shell's first-paint graph by definition (the same
 * argument `PuzzlesHomeRoute` makes about itself). It therefore imports the drill
 * INDEX — 28 entries, no positions, no content — and never the drill list screen,
 * the vision trainer or a lesson file. Those are lazy routes declared in
 * routes.tsx. Importing `@/practice` from here must not become a way to drag
 * chess.js or 1.5 MB of content onto first paint.
 */
export function PracticeScreen({ fixCount = 0, reviewCount = 0 }: { fixCount?: number; reviewCount?: number }) {
  return (
    <section className="p-4">
      <h1 className="t-display">Practice</h1>
      <p className="t-body mt-2 text-content-dim">
        Short, focused work on one thing at a time.
      </p>

      <ul className="mt-6 flex flex-col gap-3">
        {/* F-PR-3's two entries first when there is anything in them: the
            learner's own mistakes come before a generic stream, which is the
            ordering F-PZ-3 already established on the puzzles home. */}
        {fixCount > 0 && (
          <li>
            <Entry
              to="/puzzles/fix"
              title="Fix my mistakes"
              detail={`${plural(fixCount, 'mistake')} from your own games, first in the stream.`}
            />
          </li>
        )}
        {reviewCount > 0 && (
          <li>
            <Entry
              to="/play/review"
              title="Review queue"
              detail={`${plural(reviewCount, 'game')} waiting to be reviewed.`}
            />
          </li>
        )}
        <li>
          <Entry
            to="/practice/drills"
            title="Drills"
            detail={`${String(DRILLS.length)} positions to play out: mates, motifs, endgames and the Section 1 mini-games.`}
          />
        </li>
        <li>
          <Entry
            to="/practice/vision"
            title="Vision trainer"
            detail={`Thirty seconds a round: ${VISION_MODES.map((m) => MODE_TITLE[m].toLowerCase()).join(', ')}.`}
          />
        </li>
        <li>
          <Entry to="/puzzles" title="Puzzles" detail="The rated stream, themed sets and the daily puzzle." />
        </li>
      </ul>

      {/* F-PR-3 asks that both be REACHABLE from Practice. When there is nothing
          in either, saying so is better than hiding the section: a learner who
          came looking for the review queue needs to know it is empty, not to
          wonder whether they are on the wrong screen. */}
      {fixCount === 0 && reviewCount === 0 && (
        <p className="t-body mt-6 text-content-dim" data-testid="nothing-waiting">
          Nothing waiting in your review queue, and no mistakes logged yet. Play a game and they will appear here.
        </p>
      )}
    </section>
  );
}

/**
 * One entry. The whole card is the link, so the tap target is the card and there
 * is one tab stop per destination — the shape `PuzzlesScreen` and `TodayScreen`
 * both settled on.
 */
function Entry({ to, title, detail }: { to: string; title: string; detail: string }) {
  return (
    <Link
      to={to}
      className="tap n-panel n-lit n-edge block rounded-card bg-panel p-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span className="t-title block">{title}</span>
      <span className="t-body mt-1 block text-content-dim">{detail}</span>
    </Link>
  );
}
