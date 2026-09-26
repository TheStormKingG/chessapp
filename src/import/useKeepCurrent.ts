import { useEffect, useRef } from 'react';
import { reportError } from '@/analytics';
import { runBackgroundAnalysis } from './analysisQueue';
import { makeImportedGameAnalyser } from './analyseImported';
import { checkForNewGames } from './runImport';
import { useImportSettings } from './settings';

/**
 * F-IM-4, "Keeping it current", the on-open half.
 *
 * > "Once a username is entered, the app checks for new games each time it opens
 * > and on a daily job when the learner is signed in, and adds them to the
 * > profile. The learner can turn this off."
 *
 * Mounted once, by `App`. It does three things and only when there is something to
 * do: checks the learner's linked accounts for new games, stores what is new, and
 * resumes F-IM-3's background analysis for anything still pending — which is also
 * what makes "continue on a later visit if the app is closed" true, because the
 * pending state lives in Dexie and this is the visit that picks it up.
 *
 * ── WHAT IS NOT HERE ─────────────────────────────────────────────────────────
 *
 * The "daily job when the learner is signed in" is not implemented and is not
 * implementable from this codebase. A job that runs while the app is closed needs
 * something running while the app is closed; this app is a static PWA served from
 * GitHub Pages whose only backend is Supabase, used for auth and sync. Delivering
 * it would mean new server infrastructure — a scheduled Supabase Edge Function, or
 * a push service — which is a decision for the repository owner.
 *
 * The once-a-day gate in `checkIsDue` is what makes the on-open check carry most of
 * that requirement's value anyway: a learner who opens the app daily is checked
 * daily, and one who opens it five times in an hour is checked once.
 */
export function useKeepCurrent(): void {
  /*
   * Guards against the development build's deliberate double-mount.
   *
   * This is written against the ACTION, not against a count of runs: the ref
   * records that a check has been started, and the second mount sees that and does
   * nothing. A "skip the first run" counter would invert here — it would suppress
   * the real check and then fire on the remount — which is the failure this
   * codebase has already been bitten by once.
   */
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let live = true;

    void (async () => {
      const s = useImportSettings.getState();
      try {
        await checkForNewGames(
          {
            keepCurrent: s.keepCurrent,
            accounts: s.accounts.map((a) => ({ source: a.source, username: a.username })),
            lastCheckedAt: s.lastCheckedAt,
          },
          { fetch: (url, init) => fetch(url, init) },
        );
        // Stamped only after the check actually ran to completion, so a failed
        // check is retried on the next open rather than counting as today's.
        if (live) useImportSettings.getState().setLastCheckedAt(new Date().toISOString());
      } catch (e) {
        reportError(e, { where: 'import:keepCurrent' });
      }
      if (!live) return;
      // F-IM-3: the rest are analysed in the background while the app is open,
      // resuming whatever a previous visit left pending.
      try {
        await runBackgroundAnalysis({
          analyser: makeImportedGameAnalyser(),
          shouldContinue: () => live,
        });
      } catch (e) {
        reportError(e, { where: 'import:resume' });
      }
    })();

    return () => {
      live = false;
    };
  }, []);
}
