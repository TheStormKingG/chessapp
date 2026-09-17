import { Link } from 'react-router';
import { useProgress } from '@/data';
import { track } from '@/analytics';
import { hasCheckpoint } from '@/lesson';
import { SECTION_1 } from './curriculum';
import { pathNodes, type Node } from './progress';
import { resumeLabel, useLessonResume } from './resumeLabel';

const badge: Record<Node['state'], string> = {
  done: 'bg-accent text-white',
  testedOut: 'bg-accent-soft text-accent',
  active: 'ring-2 ring-accent bg-card',
  locked: 'bg-line text-ink-muted',
  coming: 'bg-line text-ink-muted',
  available: 'bg-review-soft text-review',
  passed: 'bg-accent text-white',
};

const lessonHint: Record<Extract<Node, { kind: 'lesson' }>['state'], string> = {
  done: 'Done',
  active: 'Up next',
  locked: 'Locked',
  coming: 'Content coming',
  testedOut: 'Tested out',
};

export function PathScreen() {
  const progress = useProgress((s) => s.progress);
  const nodes = pathNodes(progress);
  // Only the active lesson can have work waiting in it: every other node is
  // done, locked, or not yet built.
  const activeLesson = nodes.find(
    (n): n is Extract<Node, { kind: 'lesson' }> => n.kind === 'lesson' && n.state === 'active',
  );
  const resume = useLessonResume(activeLesson?.id ?? null);
  return (
    <section className="p-4">
      <p className="text-xs uppercase tracking-wide text-ink-muted">
        Section {SECTION_1.id} · {SECTION_1.band}
      </p>
      <h1 className="text-xl font-semibold">{SECTION_1.title}</h1>
      <ol className="mt-4 space-y-2">
        {nodes.map((n) => {
          const key = n.kind === 'lesson' ? n.id : `cp-${n.unit}`;
          const enabled =
            n.kind === 'lesson'
              ? n.state === 'active' || n.state === 'done' || n.state === 'testedOut'
              : n.state !== 'coming' && hasCheckpoint(n.unit);
          const to = n.kind === 'lesson' ? `/lesson/${n.id}` : `/checkpoint/${n.unit}`;
          const label = n.kind === 'lesson' ? `${n.id} ${n.title}` : n.title;
          // An interrupted lesson says so, and its control reads as a resumption
          // rather than a start. A missing or stale record falls straight back
          // to the wording every other node uses.
          const resumed = n.kind === 'lesson' && n.state === 'active' ? resumeLabel(resume, n.id) : null;
          const hint =
            n.kind === 'lesson'
              ? n.state === 'done'
                ? `${progress.lessons[n.id]?.stars ?? 0} stars`
                : (resumed?.hint ?? lessonHint[n.state])
              : n.state === 'passed'
                ? 'Passed'
                : !hasCheckpoint(n.unit)
                  ? 'Content coming'
                  : n.state === 'active'
                    ? 'Up next'
                    : 'Attempt any time to test out';
          const inner = (
            <div
              className={`tap flex items-center gap-3 rounded-xl border border-line px-3 py-3 ${badge[n.state]}`}
            >
              <span aria-hidden className="text-lg">
                {n.kind === 'checkpoint' ? '🏁' : n.state === 'done' ? '✓' : '•'}
              </span>
              <span className="flex-1">
                <span className="block font-medium">{label}</span>
                <span className="block text-xs opacity-80">{hint}</span>
              </span>
            </div>
          );
          return (
            <li key={key}>
              {enabled ? (
                <Link
                  to={to}
                  aria-label={resumed ? `${label}. ${hint}. ${resumed.action}` : `${label}. ${hint}`}
                  onClick={() => {
                    track('path_node_opened', { kind: n.kind, to, state: n.state });
                  }}
                >
                  {inner}
                </Link>
              ) : (
                <div aria-disabled="true" aria-label={`${label}. ${hint}`}>
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
