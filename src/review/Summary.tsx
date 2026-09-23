import { useState } from 'react';
import { btn } from '@/app/Button';
import { plural } from '@/app/plural';
import { LabelChip } from './LabelChip';
import { LABEL_ORDER, DEFINITION } from './labelStyle';
import type { Review } from './types';

/**
 * PRD F-RV-3 and Wireframes screen 14. Concept-Note section 7: "accuracy for
 * both sides, the move at which the game left the opening book, a count of
 * moves by label, the phase where the game turned".
 *
 * Layout note: the counts are a WRAPPING LIST, not a fixed grid, because the
 * app must survive a 32px root without a horizontal scrollbar
 * (tests/audit-platform/reflow.spec.ts) and a grid of ten chips will not.
 *
 * The opening block renders only when the book supplied a name. Offline with no
 * cached book that is the normal case (openingBook is not precached), and the
 * screen must then simply have no opening line rather than an empty field.
 */

/** Ply 0 is White's move 1; ply 8 is White's move 5. */
function moveNumber(ply: number): number {
  return Math.floor(ply / 2) + 1;
}

export function Summary({ review, onStart }: { review: Review; onStart: () => void }) {
  const [showDefs, setShowDefs] = useState(false);
  const present = LABEL_ORDER.filter((l) => (review.counts[l] ?? 0) > 0);
  const moments = review.keyMoments.length;

  return (
    <div className="mx-auto w-full max-w-xl p-4">
      <h1 className="t-display">Game review</h1>

      {/* F-CO-4 applies to the app's own copy, not only to the coach. This used
          to read "Still analysing the last few moves", and nothing was: there
          is no scheduler and no continuation in src/. `reviewFor` throws the
          cached partial away and analyses from scratch on the next visit, which
          is the step actually offered here.

          `bankReview` now banks a partial review (PRD §2.2 — the learner did
          the work, and a slow device is not a reason to withhold the credit).
          So the copy states three things that are all true: the analysis
          stopped before the end, it covers the first N moves, and the game
          counted anyway. It still must not promise background work. */}
      <p aria-live="polite" className="t-caption mt-1 text-content-dim">
        {review.partial
          ? `This review is not complete: the analysis stopped early and covers the first ${String(review.moves.length)} ${review.moves.length === 1 ? 'move' : 'moves'}. This game still counts as reviewed. Open this review again to analyse the whole game.`
          : `Analysed at depth ${String(review.depth)}.`}
      </p>

      <section className="mt-4 n-panel n-edge rounded-card bg-panel p-4" aria-labelledby="rv-acc">
        <h2 id="rv-acc" className="t-heading">Accuracy</h2>
        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
          <div>
            <dt className="t-label text-content-dim">You</dt>
            <dd className="t-display-lg">{fmt(review.learner === 'w' ? review.accuracy.w : review.accuracy.b)}</dd>
          </div>
          <div>
            <dt className="t-label text-content-dim">Opponent</dt>
            <dd className="t-display-lg">{fmt(review.learner === 'w' ? review.accuracy.b : review.accuracy.w)}</dd>
          </div>
        </dl>
      </section>

      {review.opening && (
        <p className="t-body mt-4">
          {review.opening.name}
          {review.opening.leftBookAtPly === null
            ? ' — the game never left the book.'
            : ` — you left the book at move ${String(moveNumber(review.opening.leftBookAtPly))}.`}
        </p>
      )}

      <section className="mt-4" aria-labelledby="rv-counts">
        <h2 id="rv-counts" className="t-heading">Your moves</h2>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          {present.map((l) => (
            <li key={l} className="flex items-baseline gap-2">
              <span className="t-display">{review.counts[l]}</span>
              <LabelChip label={l} />
            </li>
          ))}
        </ul>
        <button type="button" className={`${btn.quiet} mt-2`} onClick={() => { setShowDefs((v) => !v); }}>
          What do these mean?
        </button>
        {showDefs && (
          <dl className="mt-2 n-panel n-edge rounded-card bg-panel p-4">
            {LABEL_ORDER.map((l) => (
              <div key={l} className="mt-2 first:mt-0">
                <dt><LabelChip label={l} /></dt>
                <dd className="t-caption text-content-dim">{DEFINITION[l]}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {review.turningPhase && (
        <p className="t-body mt-4">The game turned in the {review.turningPhase}.</p>
      )}

      <p className="t-body mt-4">
        {moments === 0
          ? 'Nothing in this game needed a second look.'
          : `${plural(moments, 'moment')} worth a second look.`}
      </p>

      {moments > 0 && (
        <button type="button" className={`${btn.primary} mt-4 w-full`} onClick={onStart}>
          Start with the first moment
        </button>
      )}
    </div>
  );
}

function fmt(v: number | null): string {
  return v === null ? '—' : v.toFixed(1);
}
