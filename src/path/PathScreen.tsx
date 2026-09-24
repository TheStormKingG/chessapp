import { useEffect } from 'react';
import { plural } from '../app/plural';
import { Link } from 'react-router';
import { RailIndex, RailMeter, railMeterLabel } from '@/board';
import { useProgress, type Progress } from '@/data';
import { track } from '@/analytics';
import { hasCheckpoint } from '@/lesson';
import { SECTIONS } from './curriculum';
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

/**
 * The boundary's heading, PREMIUM-DELTA.md Δ3.
 *
 * It used to read "Locked until you get there" on both groups. A label whose
 * value is constant across the set is a section heading printed twice: it cost
 * a line each time and told the learner nothing either time. What differs
 * between the two runs is how long they are -- seven and five on a fresh path
 * -- and the length is the only thing here a learner can act on, because it is
 * the distance between where they are and the next thing that opens.
 *
 * The word "Locked" is still never printed per node, which is what the C2 fix
 * bought and what `PathScreen.test.tsx` guards. The accessible name is
 * untouched: every locked node still carries `1.1.2 The rook. Locked`
 * verbatim, asserted end to end by `tests/audit/path-today.spec.ts:43`.
 */
const GROUP_HEADING: Record<'locked' | 'coming', (n: number) => string> = {
  locked: (n) => `${String(n)} locked`,
  coming: (n) => `${String(n)} coming`,
};

function groupedState(n: Node): 'locked' | 'coming' | null {
  if (n.kind === 'lesson') return n.state === 'locked' || n.state === 'coming' ? n.state : null;
  return n.state === 'coming' ? 'coming' : null;
}

/**
 * A run never spans a unit.
 *
 * Runs of consecutive unreachable nodes collapse so the path does not print
 * "Locked" forty times, and the number the boundary prints is the distance to
 * the next thing that opens (PREMIUM-DELTA Δ3). That distance is only
 * meaningful within a unit: a fresh Section 1 path reads "7 locked" then
 * "5 locked" because a *locked* checkpoint is not groupable and so happened to
 * break the run at each unit's end.
 *
 * A `coming` checkpoint IS groupable, so nothing broke the run once a whole
 * section was unbuilt, and Section 2's 44 nodes fused into one "44 coming"
 * groove. 44 is not a distance to anything — it is the length of the rest of
 * the curriculum.
 *
 * Breaking on the unit is the rule the checkpoint was standing in for, so it
 * is stated directly here rather than left to depend on which states a
 * checkpoint happens to take. Checkpoints stay groupable, which is what keeps
 * a `coming` unit to one row rather than one row per lesson plus a checkpoint.
 */
function toRuns(nodes: Node[]): Run[] {
  const runs: Run[] = [];
  let lastUnit: string | null = null;
  for (const node of nodes) {
    const state = groupedState(node);
    if (!state) {
      runs.push({ kind: 'single', node });
      lastUnit = node.unit;
      continue;
    }
    const last = runs.at(-1);
    if (last?.kind === 'group' && last.state === state && lastUnit === node.unit) {
      last.nodes.push(node);
    } else {
      runs.push({ kind: 'group', state, nodes: [node] });
    }
    lastUnit = node.unit;
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
        ? plural(progress.lessons[n.id]?.stars ?? 0, 'star')
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
 * The fill and border that say what a node is, without a word doing it.
 *
 * PREMIUM-DELTA.md §3.3 measured the defect this replaces: the checkpoint was a
 * full-bleed saturated `--signal-soft` slab, taller than the active node, while
 * the active node's entire visual weight was a 2px outline. Two of those slabs
 * were visible at once on a 390px screen, so **the eye landed on the thing the
 * learner was not doing** -- a thing that is optional and not yet due -- and had
 * to hunt for the one thing they were.
 *
 * The ranking is now carried by elevation rather than by tint, which is Δ1's
 * rule applied to a list:
 *
 *   1. **Active** -- the one thing to do next. `--surface-raised`, a 2px
 *      `--accent` border, and the screen's only 3px `--key-accent` bottom edge
 *      (Δ1 rule 2: at most one element per screen carries it). It is the only
 *      node that is physically raised further than its neighbours.
 *   2. **Due checkpoint** -- an active checkpoint is both the next thing and a
 *      checkpoint, so it keeps the key edge and is the *only* surviving use of
 *      `--signal-soft` on this screen. The tint now means "due", once.
 *   3. **Available checkpoint** -- no longer a slab. A `--signal` outline on
 *      `--surface-raised`, the same height as any other row, with the
 *      `CheckpointFlag` still carrying the state in its own channel.
 *   4. **Finished** (done, tested out, passed) -- quiet: `--surface-raised`
 *      with an `--edge-strong` hairline, its rail segment filled in `--accent`,
 *      its title at weight 600 and a `✓` on the row. Three channels, none of
 *      them colour alone. It used to be a fully filled `--accent` slab, which
 *      made the past louder than the present.
 *
 * NEUMORPHIC-DELTA.md §6 / chunks N2 and N3 change what carries that ranking,
 * not the ranking itself. The 2px `--key-raised` bottom edge is gone from every
 * row: a card that carries a soft neumorphic raise AND a crisp solid bottom
 * border is running two depth grammars at once, and §6 allows one per element
 * class — containers get the shadow, controls get `--edge-strong` plus the
 * shadow, and the screen's one primary action adds the crisp key edge. So the
 * rows now rank by DEPTH, which is the same information in the style the rest
 * of the app moved to:
 *
 *   - **Active** — `n-raised` plus its 2px `--accent` border plus the screen's
 *     only 3px `--key-accent` bottom edge. Raised, bounded and keyed: three
 *     channels, the most of anything on the screen.
 *   - **Due checkpoint** — `n-raised` and the key edge, on `--signal-soft`.
 *     Still the one signal-soft element on the screen.
 *   - **Available checkpoint** and **finished** — `n-raised` and their own
 *     hairline, no key edge. Present, actionable, quiet.
 *   - **A locked or unbuilt run** — `n-inset-soft`, a GROOVE (chunk N3). It is
 *     the one thing on this screen that is cut INTO the ground rather than
 *     lifted off it, which is the depth grammar saying what the counted heading
 *     says in words: this is not yet surface. Nothing in it can be pressed, so
 *     nothing in it owes a control's edge.
 *
 * Every row that receives a press keeps `--radius-control` (12px); the grooved
 * run is a container and takes `--radius-card` (16px), per §3.5.
 *
 * `--accent-soft` is gone from here. PREMIUM-DELTA.md §5 found it doing five
 * different jobs across the app, against the one-colour-one-meaning rule the
 * palette is built on; the tested-out node is one of the four that lose it, and
 * the key edge plus the `✓` carry more information than the tint did.
 */
function skinFor(node: Node): string {
  // ONE bottom-edge class per row, and now at most one: `--key-raised` has left
  // this screen entirely (chunk N2), so the hazard the previous pass measured
  // -- two utilities setting `border-bottom-color`, with Tailwind's emission
  // order silently deciding which wins, which cost the active node its moment
  // of elevation -- cannot recur here. `PathScreen.test.tsx` now asserts the
  // absence rather than the ordering.
  //
  // Every row is a control: `Row` renders a Link or an `aria-disabled` div that
  // occupies the same box, so each keeps a real border at 3:1 (§3.3) AND the
  // raise. That is the control grammar, not the two-grammar mistake: the raise
  // is the depth, the border is the bound, and only the active row adds a key.
  const card = 'n-panel n-lit n-edge bg-panel text-content';
  const keyEdge = 'border-b-[3px] border-b-key-accent';
  if (node.state === 'active') {
    return node.kind === 'checkpoint'
      ? `n-panel border-2 border-signal bg-signal-soft text-signal ${keyEdge}`
      : `border-2 border-accent ${card} ${keyEdge}`;
  }
  if (node.state === 'passed' || node.state === 'done' || node.state === 'testedOut') {
    // `card` already carries n-edge, which paints the lit/shadow pair per side.
    // A blanket `border-edge-strong` here would repaint all four and undo it.
    return card;
  }
  // The remaining case is a checkpoint of a built unit that is attemptable but
  // not yet due: an outline, not a slab.
  return `border border-signal ${card}`;
}

/** Finished work, in whichever of the three ways a node can be finished. */
function isFinished(node: Node): boolean {
  return node.state === 'passed' || node.state === 'done' || node.state === 'testedOut';
}

/** A node the learner can act on, or is looking at. */
function Row({ node, view }: { node: Node; view: NodeView }) {
  const inner = (
    <div
      // The scroll target. An attribute rather than a ref threaded down through
      // Section: the screen has one active node out of 202, and a query for it
      // is both simpler and closer to what it means -- "the row that says where
      // you are" -- than a ref passed through a component that does not care.
      data-path-active={node.state === 'active' ? '' : undefined}
      className={`tap flex items-center gap-3 rounded-control px-3 py-3 ${skinFor(node)}`}
    >
      <RailIndex tone={isFinished(node) ? 'accent' : 'inherit'}>{railNumber(node)}</RailIndex>
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
      {node.kind === 'lesson' && isFinished(node) && (
        /*
          The completed state's third channel. Tested out is finished too -- the
          learner proved the lesson at the checkpoint instead of sitting it --
          so it earns the same mark, which is what it gains in place of the
          `--accent-soft` tint PREMIUM-DELTA.md §5 retired.
        */
        <span aria-hidden className="t-title shrink-0 leading-none text-accent">
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
    /*
      Chunk N3. The run is a GROOVE: `n-inset-soft` cut into the page ground,
      with no fill of its own and no `--edge-strong` ring. The ring came off for
      the same reason it came off the other containers (§6) -- a 3.76:1 control
      border paints "press me" on a box in which nothing can be pressed -- and
      the shadow pair is what bounds it instead. The inner divider stays
      `--edge`, a decorative hairline with no contrast duty (§3.5).
    */
    <div className="n-inset-soft rounded-card">
      <p aria-hidden className="t-caption border-b border-edge px-3 py-2 text-content-dim">
        {GROUP_HEADING[state](nodes.length)}
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

/**
 * One section: its header, its own meter, and its own run of nodes.
 *
 * The header is the three lines the screen has always printed -- the caption,
 * the display title, the count -- moved off `SECTION_1` and onto whichever
 * section this is. Nothing about the visual language changes; there is simply
 * more than one of it now.
 *
 * `level` exists because the sections rank equally and a screen may carry one
 * `h1`. The first section keeps it; the rest are `h2` at the same `t-display`
 * size, so the heading ORDER stays valid without the type changing size.
 *
 * **The meter counts this section's lessons, not the path's.** A single
 * path-wide meter would read "0 of 65 done" under a "Section 1" heading: wrong
 * about the heading, because the 36 it counts are not in Section 1, and wrong
 * about the work, because 36 of them are declared-but-unbuilt and a learner
 * cannot sit any of them. Per-section is also what the meter already means
 * positionally -- it sits in the gutter beside one section's list.
 */
function Section({
  section,
  nodes,
  level,
  progress,
  activeLesson,
  resumed,
}: {
  section: (typeof SECTIONS)[number];
  nodes: Node[];
  level: 1 | 2;
  progress: Progress;
  activeLesson: Extract<Node, { kind: 'lesson' }> | undefined;
  resumed: ResumeLabel | null;
}) {
  const Heading = level === 1 ? 'h1' : 'h2';
  // What the meter counts: lessons, because a lesson is the unit of work a
  // learner actually sits. A checkpoint is a gate on that work rather than more
  // of it, so counting it would make the total disagree with the list the
  // learner can see. Tested out counts as done -- the learner proved it.
  const lessons = nodes.filter((n) => n.kind === 'lesson');
  const lessonCount = lessons.length;
  const doneCount = lessons.filter((n) => n.state === 'done' || n.state === 'testedOut').length;

  return (
    <div>
      <p className="t-caption uppercase tracking-wide text-content-dim">
        Section {section.id} &middot; {section.band}
      </p>
      <Heading className="t-display">{section.title}</Heading>
      {/*
        PREMIUM-DELTA.md Δ3. The count comes first and in words, because the
        meter beside it is `aria-hidden` decoration: this line is what a screen
        reader reads, what a forced-colours rendering keeps, and what makes the
        meter something other than a colour-only signal.
      */}
      <p className="t-index mt-3 text-content-dim">{railMeterLabel(doneCount, lessonCount)}</p>
      <div className="mt-2 flex items-stretch gap-3">
        <RailMeter done={doneCount} total={lessonCount} />
        <ol className="min-w-0 flex-1 space-y-2">
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
      </div>
    </div>
  );
}

/**
 * Open the Path where the learner actually is.
 *
 * The Path is one document, top to bottom, and it opened at the top every
 * time. Measured on a 390px phone with the full v1 curriculum declared: the
 * document is 11,218px, and a learner part-way through Section 3 sits 6,075px
 * down -- SEVEN AND A HALF SCREENS of finished work to scroll past to find out
 * where they are. Declaring Section 4 made the document 38% taller and turned
 * a mild annoyance into the normal case, since every learner is above most of
 * the path for most of the course.
 *
 * Three things it deliberately does NOT do:
 *
 *   - It does not scroll when the active row is already on screen. A learner in
 *     unit 1.1 is looking straight at their position, and moving the page under
 *     them would be a jump with no purpose. This is why the visibility test is
 *     here and not just a bare `scrollIntoView`.
 *   - It does not move focus. Scrolling is an accommodation for a long
 *     document; taking the keyboard cursor away from where the learner put it
 *     is a different act, and the row is reachable by tab like any other.
 *   - It does not re-run when progress changes. Finishing a lesson while the
 *     Path is open must not yank the page -- the effect is once per mount,
 *     which is the moment the question "where am I?" is actually being asked.
 *
 * Reduced motion gets an instant jump rather than no jump: the preference asks
 * for the travel to be removed, not for the learner to be left at the top.
 */
function useOpenAtActive(): void {
  useEffect(() => {
    const el = document.querySelector('[data-path-active]');
    // jsdom has no layout and no scrollIntoView; there is nothing to place.
    if (!(el instanceof HTMLElement) || typeof el.scrollIntoView !== 'function') return;
    const box = el.getBoundingClientRect();
    const inView = box.top >= 0 && box.bottom <= window.innerHeight;
    if (inView) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    // Once per mount. Progress changing while the Path is open must not move
    // the page under the learner. The effect reads nothing reactive, so the
    // empty dependency list is what the rule wants anyway -- no suppression.
  }, []);
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
  // Grouped by the section each node CARRIES, not by parsing its id: a node
  // knows which section declared it, so Section 10 cannot quietly land in
  // Section 1 the way a `startsWith('1.')` would put it.
  useOpenAtActive();
  const sections = SECTIONS.map((section) => ({
    section,
    nodes: nodes.filter((n) => n.section === section.id),
  })).filter((s) => s.nodes.length > 0);

  return (
    <section className="space-y-8 p-4">
      {sections.map(({ section, nodes: own }, i) => (
        <Section
          key={section.id}
          section={section}
          nodes={own}
          level={i === 0 ? 1 : 2}
          progress={progress}
          activeLesson={activeLesson}
          resumed={resumed}
        />
      ))}
    </section>
  );
}
