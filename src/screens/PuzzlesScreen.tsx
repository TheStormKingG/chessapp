import { Link } from 'react-router';
import { plural } from '@/app/plural';
import { THEME_LABEL, THEMES } from '@/puzzles/themes';

/**
 * The puzzles home (design spec §5.1). It replaces the eight-line stub whose
 * only content was an apology for itself.
 *
 * Three entry points — the rated stream, themed practice, the daily puzzle —
 * with fix-my-mistakes ABOVE them whenever the error log is non-empty, because
 * F-PZ-3 makes the learner's own mistakes first in the stream. That is an
 * ordering requirement and not a presence one: an entry rendered last would
 * satisfy "it is on the screen" and none of what F-PZ-3 asks for.
 *
 * The count is a prop rather than a store read, for the same reason
 * `LessonPlayer` takes a lesson rather than a lesson id: the screen renders
 * what it is given, and the route that mounts it owns where the number came
 * from. It defaults to 0 so the route can mount the screen before the log has
 * been read, and an unknown count renders as "no mistakes waiting" rather than
 * as an entry that leads to an empty queue.
 */
export function PuzzlesScreen({ fixCount = 0 }: { fixCount?: number }) {
  return (
    <section className="p-4">
      <h1 className="t-display">Puzzles</h1>

      <ul className="mt-6 flex flex-col gap-3">
        {fixCount > 0 && (
          <li>
            <Entry
              to="/puzzles/fix"
              title="Fix my mistakes"
              detail={`${plural(fixCount, 'mistake')} from your own games, first in the stream.`}
            />
          </li>
        )}
        <li>
          <Entry
            to="/puzzles/rated"
            title="Start solving"
            detail="A stream picked for you, one puzzle at a time."
          />
        </li>
        <li>
          <Entry
            to="/puzzles/themed"
            title="Themed practice"
            detail={`No timer and no rating: ${THEMES.map((t) => THEME_LABEL[t]).join(', ')}.`}
          />
        </li>
        <li>
          <Entry
            to="/puzzles/daily"
            title="Daily puzzle"
            detail="The same puzzle for everyone today. Three attempts."
          />
        </li>
      </ul>
    </section>
  );
}

/**
 * One entry. The whole card is the link, so the tap target is the card and
 * there is one tab stop per destination rather than a card containing a link
 * inside it — the shape `TodayScreen` settled on for the same reason.
 */
function Entry({ to, title, detail }: { to: string; title: string; detail: string }) {
  return (
    <Link
      to={to}
      className="tap block rounded-control border border-edge-strong bg-surface-raised p-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span className="t-title block">{title}</span>
      <span className="t-body mt-1 block text-content-dim">{detail}</span>
    </Link>
  );
}
