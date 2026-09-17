import { Link, useLocation } from 'react-router';

/**
 * Any address the app does not know about lands here rather than on an empty
 * <main>: a stale bookmark, a mistyped path or a link from an older build.
 * The learner is told plainly what happened and given the two places worth
 * going back to.
 */
export function NotFoundScreen() {
  const { pathname } = useLocation();
  return (
    <section className="space-y-4 p-4 pb-24">
      <h1 className="text-xl font-semibold">That page is not here</h1>
      <p className="text-ink-muted">
        Nothing in ChessApp lives at <code className="break-all">{pathname}</code>. The address may be mistyped, or it
        may be a bookmark from an older version of the app.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link to="/" className="tap rounded-lg bg-accent px-4 py-2 font-medium text-white">
          Go to Today
        </Link>
        <Link to="/path" className="tap rounded-lg border border-line px-4 py-2 font-medium">
          Go to the Path
        </Link>
      </div>
    </section>
  );
}
