import { SECTIONS } from './curriculum';
import { hasCheckpoint, listLessons, loadLesson } from '@/lesson/loader';

/*
 * `built: true` is a claim about the disk, and nothing checked it.
 *
 * The flag decides whether the path offers a unit as a link or as "Content
 * coming". Flipping it is a one-word edit in `curriculum.ts`, made in a
 * different commit from the content it is about, usually at the end of a long
 * authoring pass with eleven other units in flight. The two ways that goes
 * wrong are opposite and both silent:
 *
 *   - Flipped with no content behind it. The learner taps a real-looking link
 *     and gets "this lesson could not be loaded" -- the failure mode Section 2
 *     shipped live, where a unit was reachable and its chunk was not.
 *   - Content authored and the flag never flipped. The unit is finished, sitting
 *     in the repository, and invisible to everyone. Nothing anywhere reports
 *     this; it looks exactly like a unit nobody has written yet.
 *
 * The second is why this asserts BOTH directions rather than only the dangerous
 * one. A test that checked only "built units have content" would be green all
 * the way through a release that forgot to turn a unit on.
 *
 * It reads the same `import.meta.glob` the app reads, so it is the app's own
 * view of what exists, not a second directory walk that could agree with the
 * curriculum while the bundler disagreed with both.
 */

const units = SECTIONS.flatMap((s) => s.units);

/*
 * Guidebooks, by the unit that owns them.
 *
 * `curriculum.ts` states the rule in three places -- a unit stays
 * `built: false` "until its lessons, checkpoint and guidebook are authored" --
 * and this file originally checked only the first two. That gap showed up the
 * moment twelve units were being authored in parallel: a unit with every lesson
 * and a checkpoint on disk but no guidebook yet counted as finished, so the
 * test demanded a flip for a unit whose author was still writing.
 *
 * Read through the same `import.meta.glob` the app uses for content, so this is
 * the bundler's view of the tree rather than a second directory walk that could
 * agree with the curriculum while disagreeing with the build.
 */
const guidebooks = new Set(
  Object.keys(import.meta.glob('/content/section-*/unit-*/guidebook.md')).map(
    (p) => /unit-([\d.]+)\//.exec(p)?.[1] ?? '',
  ),
);

test('the corpus is non-empty, so neither direction below passes by matching nothing', () => {
  expect(units.length).toBe(38);
  expect(units.filter((u) => u.built).length).toBeGreaterThan(0);
  expect(units.filter((u) => !u.built).length).toBeGreaterThan(0);
});

test('every unit marked built has a lesson file for each declared lesson', () => {
  const missing: string[] = [];
  for (const u of units) {
    if (!u.built) continue;
    const onDisk = new Set(listLessons(u.id));
    for (const l of u.lessons) if (!onDisk.has(l.id)) missing.push(l.id);
  }
  // Named, not counted: the point of failing is to say which lesson to write.
  expect(missing).toEqual([]);
});

test('every unit marked built has a guidebook', () => {
  // The third of the three things `curriculum.ts` says a built unit owes. It
  // is not loaded by the app, which is exactly why nothing else would notice
  // it missing.
  const missing = units.filter((u) => u.built && !guidebooks.has(u.id)).map((u) => u.id);
  expect(missing).toEqual([]);
  expect(guidebooks.size).toBeGreaterThan(0); // the glob resolved at all
});

test('every unit marked built has a checkpoint', () => {
  // A unit with lessons and no bank is passable but not completable -- the
  // checkpoint is what closes it (PRD 6.4), so this is not a lesser case of
  // the test above.
  const missing = units.filter((u) => u.built && !hasCheckpoint(u.id)).map((u) => u.id);
  expect(missing).toEqual([]);
});

test('a built lesson actually parses, not merely exists', async () => {
  // `listLessons` reads the glob's KEYS, which are paths. A file that is
  // present and malformed satisfies every check above and fails in front of a
  // learner. One real load per built unit is enough to catch a corpus-wide
  // fault (a bad schema migration, a truncated write) without loading 164
  // files, and the challenge count is asserted because an empty `challenges`
  // array parses perfectly well.
  for (const u of units) {
    if (!u.built) continue;
    const first = u.lessons[0];
    expect(first, `unit ${u.id} declares no lessons`).toBeDefined();
    const lesson = await loadLesson(first!.id);
    expect(lesson.id, `unit ${u.id}`).toBe(first!.id);
    expect(lesson.challenges.length, `lesson ${first!.id} has no challenges`).toBeGreaterThan(0);
  }
});

test('no finished unit is left switched off', () => {
  /*
   * The forgotten-flip direction. A unit that is `built: false` and has a full
   * set of lesson files plus a checkpoint is content that shipped to the
   * repository and never reached a learner.
   *
   * "Full set" is the deliberate bar. A unit mid-authoring has some of its
   * lessons on disk, and failing on the first file to appear would make this
   * red for the whole of every authoring pass -- which is how a test gets
   * disabled. It goes red only once the unit is actually finished, which is the
   * moment the flag is owed.
   *
   * ...EXCEPT when an earlier unit is not finished. `progress.test.ts` requires
   * the built set to be a contiguous PREFIX of the path, so a unit whose
   * predecessor is still being authored cannot be turned on without opening a
   * gap -- the learner would walk into "content coming" and find more content
   * behind it. Twelve units authored in parallel finish out of order routinely,
   * so without this the two rules contradict each other and one of them has to
   * be ignored.
   *
   * So the claim is "nothing that COULD be turned on is left off", which is
   * what the rule always meant. A finished unit behind an unfinished one is not
   * forgotten, it is waiting, and it becomes this test's business the moment
   * its predecessor lands.
   */
  const ids = units.map((u) => u.id);
  const firstUnbuiltIdx = units.findIndex((u) => !u.built);
  const blockedFrom = (id: string) => {
    if (firstUnbuiltIdx === -1) return false;
    const idx = ids.indexOf(id);
    // Everything after the first unbuilt unit is blocked by it, unless that
    // unit is itself the one we are asking about.
    return idx > firstUnbuiltIdx;
  };
  const finishedButOff = units
    .filter((u) => !u.built)
    .filter((u) => hasCheckpoint(u.id))
    .filter((u) => guidebooks.has(u.id))
    .filter((u) => {
      const onDisk = new Set(listLessons(u.id));
      return u.lessons.length > 0 && u.lessons.every((l) => onDisk.has(l.id));
    })
    .filter((u) => !blockedFrom(u.id))
    .map((u) => u.id);
  expect(finishedButOff, 'authored and still marked coming -- flip built to true').toEqual([]);
});
