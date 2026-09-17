import { Link } from 'react-router';
import { RailIndex } from '@/board';
import { useProgress, type Progress } from '@/data';
import { track } from '@/analytics';
import { hasCheckpoint } from '@/lesson';
import { SECTION_1 } from './curriculum';
import { CheckpointFlag } from './PathSymbols';
import { pathNodes, type Node } from './progress';
import { resumeLabel, useLessonResume } from './resumeLabel';

type ResumeLabel = NonNullable<ReturnType<typeof resumeLabel>>;

/**
 * C2 -- the Path, rebuilt around two measured defects (DESIGN-SYSTEM.md §7).
 *
 * 1. "Locked" was printed on 8 of the 10 visible nodes. A per-item label
 *    carries information only in proportion to how it varies across the set;
 *    at 8 of 10 it is a section heading printed eight times, and its uniformity
 *    was hiding the one distinction the list exists to make -- which single
 *    thing to do next. The word now appears once, on the boundary of the run it
 *    describes, and the difference it was spending is given to the active node
 *    and the checkpoint instead. `layout.md > Best practices`: "Group related
 *    items to help people find the information they want... use negative space,
 *    background shapes, colors, materials, or separator lines to show when
 *    elements are related".
 *
 *    **The accessible name does not move with it.** Every locked node still
 *    carries `1.1.2 The rook. Locked` verbatim, which is the correct name for a
 *    screen reader whatever the visible grouping does, and is asserted by
 *    `tests/audit/path-today.spec.ts:43`. The visible grouping is a
 *    presentation change; the group's own heading is `aria-hidden` so the
 *    accessible layer reads exactly as it did before this chunk.
 *
 * 2. The `🏁` emoji stood in for a structural icon on the checkpoint node,
 *    against §7 rule 8. It is now `CheckpointFlag`, a vector symbol drawn to
 *    the tab bar's own family (see `PathSymbols.tsx`), filled once the
 *    checkpoint is passed exactly as the tab bar fills the current tab.
 *
 * And the signature arrives: every node is indexed by the same mono rail as the
 * board's ranks, in the same face at the same left edge (DESIGN-SYSTEM.md §4).
 * That is what replaces the meaningless grey bullet each node used to carry --
 * the bullet said nothing; `1.1.2` says where you are.
 */

/** The visible state of a node, where it is one this list still spells out. */
const lessonHint: Record<Extract<Node, { kind: 'lesson' }>['state'], string> = {
  done: 'Done',
  active: 'Up next',
  locked: 'Locked',
  coming: 'Content coming',
  testedOut: 'Tested out',
};

/** Runs of consecutive nodes the learner cannot act on yet collapse into one boundary. */
type Run =
  | { kind: 'single'; node: Node }
  | { kind: 'group'; state: 'locked' | 'coming'; nodes: Node[] };

const GROUP_HEADING: Record<'locked' | 'coming', string> = {
  locked: 'Locked until you get there',
  coming: 'Content coming',
};

function groupedState(n: Node): 'locked' | 'coming' | null {
  if (n.kind === 'lesson') return n.state === 'locked' || n.state === 'coming' ? n.state : null;
  return n.state === 'coming' ? 'coming' : null;
}

function toRuns(nodes: Node[]): Run[] {
  const runs: Run[] = [];
  for (const node of nodes) {
    const state = groupedState(node);
    if (!state) {
      runs.push({ kind: 'single', node });
      continue;
    }
    const last = runs.at(-1);
    if (last?.kind === 'group' && last.state === state) last.nodes.push(node);
    else runs.push({ kind: 'group', state, nodes: [node] });
  }
  return runs;
}

interface NodeView {
  key: string;
  enabled: boolean;
  to: string;
  /** What the row prints. The unit number is not in it: the rail carries that. */
  title: string;
  hint: string;
  /** The accessible name, which keeps the number and the state word verbatim. */
  name: string;
}

/**
 * Everything a node needs, derived once so grouped and ungrouped rows agree.
 * `resumed` is passed in rather than read here: only the active lesson can have
 * a resume record, and the hook that loads it belongs to the screen.
 */
function read(n: Node, progress: Progress, resumed: ResumeLabel | null): NodeView {
  const key = n.kind === 'lesson' ? n.id : `cp-${n.unit}`;
  const enabled =
    n.kind === 'lesson'
      ? n.state === 'active' || n.state === 'done' || n.state === 'testedOut'
      : n.state !== 'coming' && hasCheckpoint(n.unit);
  const to = n.kind === 'lesson' ? `/lesson/${n.id}` : `/checkpoint/${n.unit}`;
  // The rail prints the unit number one column to the left, so the title must
  // not print it again -- a number repeated 12px from itself is the same defect
  // as "Locked" repeated twelve times down the column. The accessible NAME
  // still carries it, because a screen reader has no rail: `1.1.2 The rook.
  // Locked` is asserted verbatim by tests/audit/path-today.spec.ts:43.
  const label = n.kind === 'lesson' ? `${n.id} ${n.title}` : n.title;
  const title = n.title;
  const hint =
    n.kind === 'lesson'
      ? n.state === 'done'
        ? `${String(progress.lessons[n.id]?.stars ?? 0)} stars`
        : (resumed?.hint ?? lessonHint[n.state])
      : n.state === 'passed'
        ? 'Passed'
        : !hasCheckpoint(n.unit)
          ? 'Content coming'
          : n.state === 'active'
            ? 'Up next'
            : 'Attempt any time to test out';
  const name = resumed ? `${label}. ${hint}. ${resumed.action}` : `${label}. ${hint}`;
  return { key, enabled, to, title, hint, name };
}

/** The rail index for a node: a lesson's own number, a checkpoint's unit. */
function railNumber(n: Node): string {
  return n.kind === 'lesson' ? n.id : n.unit;
}

/**
 * The fill and border that say what a node is, without a word doing it. The
 * active node is the only ringed, raised one; a finished node is the only
 * filled one; a checkpoint is the only one carrying a symbol.
 */
function skinFor(node: Node): string {
  if (node.state === 'passed' || node.state === 'done') return 'border-accent bg-accent text-accent-on';
  if (node.state === 'active') return 'border-accent bg-surface-raised ring-2 ring-accent';
  if (node.state === 'testedOut') return 'border-edge-strong bg-accent-soft text-accent';
  return 'border-edge-strong bg-signal-soft text-signal';
}

/** A node the learner can act on, or is looking at. */
function Row({ node, view }: { node: Node; view: NodeView }) {
  const inner = (
    <div className={`tap flex items-center gap-3 rounded-xl border px-3 py-3 ${skinFor(node)}`}>
      <RailIndex>{railNumber(node)}</RailIndex>
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        <span className="t-heading block">{view.title}</span>
        {/*
          A2: no opacity here. The hint is the node's state in words and is the
          only visible carrier of it, so it owes 4.5:1 like any other body text.
          `opacity-80` composited it against its own fill and took these rows
          below both the requirement and the ratios DESIGN-SYSTEM.md 3.1
          measured for the exact pairs.
        */}
        <span className="t-label block">{view.hint}</span>
      </span>
      {node.kind === 'checkpoint' && (
        <CheckpointFlag filled={node.state === 'passed'} className="shrink-0" />
      )}
      {node.kind === 'lesson' && node.state === 'done' && (
        <span aria-hidden className="t-title shrink-0 leading-none">
          &#10003;
        </span>
      )}
    </div>
  );
  return view.enabled ? (
    <Link
      to={view.to}
      aria-label={view.name}
      onClick={() => {
        track('path_node_opened', { kind: node.kind, to: view.to, state: node.state });
      }}
    >
      {inner}
    </Link>
  ) : (
    <div aria-disabled="true" aria-label={view.name}>
      {inner}
    </div>
  );
}

/**
 * A run the learner cannot reach yet. One boundary, one word, and the nodes
 * inside reduced to what actually varies: their rail number and their title.
 * They stay individually labelled and individually `aria-disabled`, so nothing
 * about the screen-reader experience changes.
 */
function Group({
  state,
  nodes,
  progress,
}: {
  state: 'locked' | 'coming';
  nodes: Node[];
  progress: Progress;
}) {
  return (
    <div className="rounded-xl border border-edge-strong">
      <p aria-hidden className="t-caption border-b border-edge px-3 py-2 text-content-dim">
        {GROUP_HEADING[state]}
      </p>
      <ul className="px-3 py-2">
        {nodes.map((n) => {
          const view = read(n, progress, null);
          return (
            <li key={view.key}>
              <div
                aria-disabled="true"
                aria-label={view.name}
                className="t-label flex items-center gap-3 py-1 text-content-dim"
              >
                <RailIndex tone="dim">{railNumber(n)}</RailIndex>
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{view.title}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function PathScreen() {
  const progress = useProgress((s) => s.progress);
  const nodes = pathNodes(progress);
  // Only the active lesson can have work waiting in it: every other node is
  // done, locked, or not yet built.
  const activeLesson = nodes.find(
    (n): n is Extract<Node, { kind: 'lesson' }> => n.kind === 'lesson' && n.state === 'active',
  );
  const resume = useLessonResume(activeLesson?.id ?? null);
  // An interrupted lesson says so, and its control reads as a resumption rather
  // than a start. A missing or stale record falls straight back to the wording
  // every other node uses.
  const resumed = activeLesson ? resumeLabel(resume, activeLesson.id) : null;

  return (
    <section className="p-4">
      <p className="t-caption uppercase tracking-wide text-content-dim">
        Section {SECTION_1.id} &middot; {SECTION_1.band}
      </p>
      <h1 className="t-display">{SECTION_1.title}</h1>
      <ol className="mt-4 space-y-2">
        {toRuns(nodes).map((run) => {
          if (run.kind === 'group') {
            return (
              <li key={`${run.state}-${read(run.nodes[0]!, progress, null).key}`}>
                <Group state={run.state} nodes={run.nodes} progress={progress} />
              </li>
            );
          }
          const view = read(run.node, progress, run.node === activeLesson ? resumed : null);
          return (
            <li key={view.key}>
              <Row node={run.node} view={view} />
            </li>
          );
        })}
      </ol>
    </section>
  );
}
