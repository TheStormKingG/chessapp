import { Link } from 'react-router';
import { CATEGORY_TITLE, DRILL_CATEGORIES, GOAL_LABEL, drillKey, drillsIn, groupsIn, parLabel, type Drill } from './drills';
import { starsFor, usePractice } from './results';

/**
 * F-PR-1's list: "drills by category ... each with a goal, a par and stars."
 *
 * Every drill is an authored `play_it_out` challenge that already existed and
 * already ran; this screen is a table of contents over `DRILLS` (see drills.ts).
 * It shows the three things the requirement names and nothing invented:
 *
 *   goal  — `GOAL_LABEL[d.goal]`, from the content's own goal kind
 *   par   — `parLabel(d)`, the content's own move budget, worded so a `hold`
 *           drill's number does not read as a limit
 *   stars — `src/lesson/stars.ts`, via the results store; 0 until completed
 *
 * A lazy route, not part of the tab: it reads the results store and renders
 * twenty-eight cards, and the Practice tab itself stays static (see
 * PracticeScreen's header note on the first-paint graph).
 */
export function DrillsScreen() {
  const results = usePractice((s) => s.results);
  return (
    <section className="p-4">
      <h1 className="t-display">Drills</h1>
      <p className="t-body mt-2 text-content-dim">
        Play the position out against the coach until you reach the goal.
      </p>

      {DRILL_CATEGORIES.map((category) => (
        <section key={category} className="mt-8">
          <h2 className="t-title">{CATEGORY_TITLE[category]}</h2>
          {groupsIn(category).map((group) => (
            <div key={group} className="mt-4">
              {/* The group heading is suppressed when it is the only one and
                  repeats nothing useful: a single "Section 1" under "Section 1
                  mini-games" is a line of furniture. */}
              {groupsIn(category).length > 1 && (
                <h3 className="t-label font-semibold tracking-wide text-content-dim">{group}</h3>
              )}
              <ul className="mt-2 flex flex-col gap-3">
                {drillsIn(category)
                  .filter((d) => d.group === group)
                  .map((drill) => (
                    <li key={drillKey(drill)}>
                      <DrillCard drill={drill} stars={starsFor(results, drillKey(drill))} />
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </section>
  );
}

function DrillCard({ drill, stars }: { drill: Drill; stars: 0 | 1 | 2 | 3 }) {
  return (
    <Link
      to={`/practice/drill/${drill.lessonId}/${drill.challengeId}`}
      className="tap n-panel n-lit n-edge block rounded-card bg-panel p-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
      data-testid={`drill-${drillKey(drill)}`}
    >
      <span className="t-title block">{drill.title}</span>
      <span className="t-body mt-1 block text-content-dim">
        {GOAL_LABEL[drill.goal]} · {parLabel(drill)}
      </span>
      <Stars stars={stars} />
    </Link>
  );
}

/**
 * The stars, as text as well as shape.
 *
 * F-AX-2: colour and glyph are never the only carrier, so the count is also in
 * the accessible name. A never-completed drill says so rather than showing three
 * empty stars, because "0 of 3" and "not played" are different facts and only the
 * second is true before the first attempt.
 */
function Stars({ stars }: { stars: 0 | 1 | 2 | 3 }) {
  if (stars === 0) {
    return (
      <span className="t-label mt-2 block text-content-dim" data-testid="stars">
        Not completed
      </span>
    );
  }
  return (
    <span className="t-label mt-2 block text-content-dim" data-testid="stars">
      <span aria-hidden="true">{'★'.repeat(stars) + '☆'.repeat(3 - stars)}</span>
      <span className="sr-only">{stars} of 3 stars</span>
    </span>
  );
}
