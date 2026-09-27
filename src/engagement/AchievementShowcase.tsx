import type { Achievement } from './achievements';

/**
 * F-EN-5's showcase: "displayed in a showcase on the profile".
 *
 * The profile is the Progress tab (`screens/ProgressScreen.tsx`, which renders
 * `profile/ProfileView.tsx`), so this sits there beside the path and the totals
 * rather than on Today. Today answers "what now?"; a showcase answers "what have I
 * done", which is this screen's question.
 *
 * ── THE IDIOM ────────────────────────────────────────────────────────────────
 *
 * The Progress tab's own section grammar: a `t-caption uppercase` label over a
 * bordered list on `--surface-raised`. Earned entries first, then the ones still
 * to come with their progress, then the ones this build cannot award — each group
 * separated by a word rather than by a colour or an opacity, so the distinction
 * survives forced colours and being read aloud.
 *
 * ── A LOCKED ENTRY SAYS WHICH KIND OF LOCKED IT IS ───────────────────────────
 *
 * F-EN-5 names two examples this app cannot project (a hanging-pieces game and a
 * back-rank mate — `achievements.ts` says exactly why). They are SHOWN, under
 * their own heading, saying they are not available yet. Hiding them would make the
 * showcase look complete; showing them among the ordinary locked ones would make a
 * learner chase something that cannot happen.
 */
export function AchievementShowcase({ achievements }: { achievements: readonly Achievement[] }) {
  const earned = achievements.filter((a) => a.unlocked);
  const toCome = achievements.filter((a) => !a.unlocked && a.blocked === null);
  const notYetPossible = achievements.filter((a) => a.blocked !== null);

  return (
    <section aria-label="Achievements" className="mt-6">
      <h2 className="t-caption uppercase tracking-wide text-content-dim">Achievements</h2>
      {earned.length === 0 ? (
        <p className="t-body mt-2">
          Nothing earned yet. They are for things you do rather than for how much you do.
        </p>
      ) : (
        <ul className="mt-2 rounded-card border border-edge bg-surface-raised" data-testid="achievements-earned">
          {earned.map((a) => (
            <li key={a.id} className="border-b border-edge px-3 py-3 last:border-b-0">
              <p className="t-heading">{a.title}</p>
              <p className="t-label text-content-dim">{a.detail}</p>
              {a.unlockedOn !== null && <p className="t-index text-content-dim">{a.unlockedOn}</p>}
            </li>
          ))}
        </ul>
      )}

      {toCome.length > 0 && (
        <>
          <h3 className="t-caption mt-4 uppercase tracking-wide text-content-dim">Still to come</h3>
          <ul className="mt-2 rounded-card border border-edge bg-surface-raised" data-testid="achievements-to-come">
            {toCome.map((a) => (
              <li key={a.id} className="border-b border-edge px-3 py-3 last:border-b-0">
                <p className="t-label">{a.title}</p>
                <p className="t-index text-content-dim">
                  {a.progress} of {a.target}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      {notYetPossible.length > 0 && (
        <>
          <h3 className="t-caption mt-4 uppercase tracking-wide text-content-dim">Not in this release</h3>
          <ul className="mt-2 rounded-card border border-edge bg-surface-raised" data-testid="achievements-blocked">
            {notYetPossible.map((a) => (
              <li key={a.id} className="border-b border-edge px-3 py-3 last:border-b-0">
                <p className="t-label">{a.title}</p>
                {/* Said plainly, so nobody chases it. The engineering reason stays
                    in `achievements.ts`; the learner gets the fact. */}
                <p className="t-label text-content-dim">Waiting on work the app has not done yet.</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
