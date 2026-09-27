import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { ImportScreen } from '@/import';
import { btn } from '@/app/Button';
import { destinationPath, levelDestination } from './route';

/**
 * F-IM-5: "The level screen (F-ON-2) offers 'Import my games' as a fourth route
 * for players who already play online. The first ten games are analysed during
 * onboarding, the profile seeds the error log and the placement, and the learner's
 * first daily plan is a tailored session (F-TS-1) rather than the path's first
 * lesson."
 *
 * What this route does, and what it does not:
 *
 *  • The fourth route exists and lands here (`onboardingStart` in ./route.ts).
 *  • The first ten games ARE analysed here, by `ImportScreen`, which runs
 *    F-IM-3's foreground pass before it reports completion.
 *  • The error log IS seeded, without this file doing anything: each analysed game
 *    banks the ordinary `game_reviewed` event and writes its `ErrorEntry` rows
 *    exactly as an in-app game does, so the existing error log picks them up.
 *  • The placement fallback is honoured through `levelDestination`, called below
 *    with the real game count — the seam in ./route.ts, used as written.
 *
 *  • ✗ "the learner's first daily plan is a tailored session (F-TS-1)" is NOT
 *    honoured, and cannot be from here. F-TS is not built: there is no session
 *    builder, no tailored lesson and no `F-TS-1` anywhere in src/. A learner who
 *    imports therefore gets the path's ordinary first lesson, which is the honest
 *    behaviour available rather than a placeholder that claims to be tailored.
 *    When F-TS lands, this is the place that asks it for the first plan.
 */
export function ImportRoute() {
  const nav = useNavigate();

  const finish = useCallback(
    (added: number) => {
      /*
       * The single decision point, with the real number.
       *
       * `levelDestination` is what F-ON-2's "with the placement test as the
       * fallback when there are fewer than ten games" lives in, and it is called
       * here rather than reimplemented: fewer than ten importable games means the
       * learner still owes a placement test, ten or more means import has told us
       * enough. A `kind: 'import'` answer means the import covered it, so the
       * learner goes to Today — following `destinationPath` there would send them
       * back to this screen.
       */
      const dest = levelDestination('plays_online', added);
      void nav(dest.kind === 'import' ? '/' : destinationPath(dest), { replace: true });
    },
    [nav],
  );

  return (
    <div>
      <ImportScreen onFinished={finish} />
      <div className="px-4 pb-8">
        <button
          type="button"
          className={btn.quiet}
          onClick={() => {
            // A learner who does not want to import still needs a way through
            // onboarding. Skipping is the placement test, which is what F-ON-2
            // gives a learner whose import brought too little.
            void nav(destinationPath(levelDestination('plays_online', 0)), { replace: true });
          }}
        >
          Skip — take a short placement test instead
        </button>
      </div>
    </div>
  );
}
