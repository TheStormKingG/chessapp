import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { btn } from '@/app/Button';
import { profileBasis, type ProfileBasis } from './analysisQueue';
import { allImported } from './storage';
import type { ImportedGameRow, Speed } from './types';

/**
 * F-IM-6: "Every imported game gets a full review (section 8.6), listed in the
 * Review tab with the source, the opponent and the result."
 *
 * ── ONE HONEST NOTE ABOUT "THE REVIEW TAB" ───────────────────────────────────
 *
 * There is no Review tab. The shell has five (src/app/Shell.tsx: Today, Path,
 * Puzzles, Play, Progress) and no list of past games exists anywhere in the app —
 * `/play/review/:gameId` is reached only from a game the learner has just
 * finished. F-HM-3 refers to a Review tab as though it exists, so the PRD assumes
 * one; the build does not have it.
 *
 * This screen is that list, and it is reached at `/play/review` — beside the
 * per-game route rather than as a sixth tab, because adding a tab changes the
 * app's primary navigation for every learner, which is a product decision and not
 * this feature's to take. Every row links to the ordinary review at the ordinary
 * route, so when a Review tab does arrive it renders this component and nothing
 * else changes.
 */

const SOURCE_LABEL: Record<ImportedGameRow['source'], string> = {
  'chess.com': 'chess.com',
  lichess: 'Lichess',
  pgn: 'PGN file',
};

const SPEED_LABEL: Record<Speed, string> = {
  rapid: 'Rapid',
  blitz: 'Blitz',
  daily: 'Daily',
  bullet: 'Bullet',
  other: 'Other',
};

const RESULT_LABEL: Record<ImportedGameRow['result'], string> = {
  win: 'Won',
  loss: 'Lost',
  draw: 'Drew',
};

/** A date a person would say, from an ISO instant. Never the epoch, visibly. */
function dayLabel(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t) || t <= 0) return 'date unknown';
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ReviewListScreen() {
  const [games, setGames] = useState<ImportedGameRow[] | null>(null);
  const [basis, setBasis] = useState<ProfileBasis | null>(null);

  useEffect(() => {
    let live = true;
    void Promise.all([allImported(), profileBasis()]).then(([rows, b]) => {
      if (!live) return;
      setGames(rows);
      setBasis(b);
    });
    return () => {
      live = false;
    };
  }, []);

  if (games === null) {
    return (
      <section className="p-4 pb-24">
        <h1 className="t-display">Your games</h1>
        <p className="t-body mt-2 text-content-dim">Loading…</p>
      </section>
    );
  }

  return (
    <section className="space-y-5 p-4 pb-24">
      <div>
        <h1 className="t-display">Your games</h1>
        {/* F-IM-3: "The profile updates as games complete and shows how many games
            it is based on." The denominator is ANALYSED games, because an imported
            game that has not been analysed contributes nothing yet. */}
        {basis && basis.imported > 0 && (
          <p className="t-body mt-2 text-content-dim">
            Your profile rests on {String(basis.analysed)} analysed game
            {basis.analysed === 1 ? '' : 's'}
            {basis.pending > 0 ? `, with ${String(basis.pending)} still to analyse.` : '.'}
          </p>
        )}
      </div>

      {games.length === 0 ? (
        <div className="n-panel n-lit n-edge space-y-3 rounded-card bg-panel p-4">
          <p className="t-heading">No imported games yet.</p>
          <p className="t-label text-content-dim">
            Bring in the games you have already played and every one of them gets a full review.
          </p>
          <Link className={btn.primary} to="/import">
            Import your games
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {games.map((g) => (
            <li key={g.gameId}>
              <Link
                to={`/play/review/${g.gameId}`}
                className="tap n-panel n-lit n-edge block rounded-card bg-panel p-4"
              >
                <span className="t-heading block">
                  {RESULT_LABEL[g.result]} against {g.opponent}
                </span>
                {/* Source, opponent and result are what F-IM-6 names. The speed and
                    the date are here because a list of forty games in which every
                    row says "Lost against Rosa" is not a list a learner can use. */}
                <span className="t-label block text-content-dim">
                  {SOURCE_LABEL[g.source]} · {SPEED_LABEL[g.speed]} · {dayLabel(g.playedAt)}
                </span>
                <span className="t-caption mt-1 block text-content-dim">
                  {g.analysis === 'done'
                    ? 'Reviewed'
                    : g.analysis === 'failed'
                      ? 'Analysis did not finish — open to try again'
                      : 'Waiting to be analysed'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
