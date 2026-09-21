// The `concept` tag is not decoration. `CheckpointMachine` draws a failed
// checkpoint's retry set from the concepts the learner missed (PRD 6.4), so two
// spellings of one concept split its bank in half and the retry pool shrinks
// silently. Design spec 2026-09-19 section 5 enumerates the vocabulary in the
// schema so an unknown or misspelled tag fails verification rather than
// shipping. These tests are the executable half of that.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

interface SchemaLike {
  definitions?: { challenge?: { properties?: { concept?: { enum?: string[] } } } };
}

function vocabularyOf(schemaPath: string): string[] {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as SchemaLike;
  return schema.definitions?.challenge?.properties?.concept?.enum ?? [];
}

const LESSON_SCHEMA = 'content/schema/lesson.schema.json';
const CHECKPOINT_SCHEMA = 'content/schema/checkpoint.schema.json';
const CONCEPTS = vocabularyOf(LESSON_SCHEMA);

interface TaggedEntry {
  file: string;
  id: string;
  concept: string;
}

// Walks all of content/, not one section, so a later section is swept the day
// it lands rather than the day somebody remembers to widen the glob.
function contentFiles(dir = 'content', out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'schema') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) contentFiles(p, out);
    else if (p.endsWith('.json')) out.push(p);
  }
  return out;
}

function taggedEntries(): { entries: TaggedEntry[]; fileCount: number } {
  const entries: TaggedEntry[] = [];
  const files = contentFiles();
  for (const file of files) {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as {
      challenges?: { id?: string; concept?: string }[];
      bank?: { id?: string; concept?: string }[];
    };
    for (const c of [...(parsed.challenges ?? []), ...(parsed.bank ?? [])]) {
      if (typeof c.concept === 'string') {
        entries.push({ file, id: c.id ?? '(no id)', concept: c.concept });
      }
    }
  }
  return { entries, fileCount: files.length };
}

describe('the concept vocabulary', () => {
  test('is declared in the lesson schema', () => {
    expect(CONCEPTS.length).toBeGreaterThan(0);
  });

  test('is identical in the checkpoint schema', () => {
    expect(vocabularyOf(CHECKPOINT_SCHEMA)).toEqual(CONCEPTS);
  });

  test('has no near-duplicates', () => {
    // Two tags differing only by a hyphen are the drift this vocabulary exists
    // to stop: `check-mate` and `checkmate` are one concept in two halves.
    const normalise = (s: string): string => s.replace(/-/g, '');
    const seen = new Map<string, string>();
    for (const c of CONCEPTS) {
      const k = normalise(c);
      expect(seen.has(k), `${c} collides with ${seen.get(k) ?? ''}`).toBe(false);
      seen.set(k, c);
    }
    // Without this the loop above passes over an empty vocabulary.
    expect(seen.size).toBe(CONCEPTS.length);
    expect(seen.size).toBeGreaterThan(0);
  });
});

describe('content concept tags', () => {
  test('are all in the vocabulary', () => {
    const { entries, fileCount } = taggedEntries();
    // A sweep that finds nothing reports an empty list of problems, which is
    // the same shape as a clean sweep. Prove it looked at something first.
    expect(fileCount).toBeGreaterThan(0);
    expect(entries.length).toBeGreaterThan(0);

    const unknown = entries
      .filter((e) => !CONCEPTS.includes(e.concept))
      .map((e) => `${e.file} ${e.id}: ${e.concept}`);
    expect(unknown).toEqual([]);
  });

  test('every vocabulary entry is actually used', () => {
    // An unused tag is either a typo nobody caught or a concept that was
    // renamed and left behind. Either way it is drift with a schema blessing.
    const used = new Set(taggedEntries().entries.map((e) => e.concept));
    expect(CONCEPTS.filter((c) => !used.has(c))).toEqual([]);
  });
});

/** Every `checkpoint.json` in the corpus, so the sweep cannot miss a section. */
function checkpointFiles(): string[] {
  return contentFiles().filter((f) => f.endsWith('checkpoint.json'));
}

test('no checkpoint question names the concept it tests (PRD 6.4)', () => {
  // The Playwright suite checks this, but only over the 10 questions a run
  // happens to sample from a bank of 30+, so it fails about 40% of the time
  // and passes by luck the rest. A static sweep over every bank entry makes
  // the same guarantee deterministically.
  //
  // This is not hypothetical: merging the `check-mate` tag into `checkmate`
  // turned four 1.6 bank prompts reading "Checkmate in one move." into leaks,
  // because the un-merged spelling was not a substring of the prompt and the
  // merged one is. The merge was checked for entries MOVING concept; nothing
  // checked a renamed tag against its own prompt text.
  const leaks: string[] = [];
  for (const file of checkpointFiles()) {
    for (const entry of JSON.parse(readFileSync(file, 'utf8')).bank) {
      if (entry.prompt.toLowerCase().includes(entry.concept.toLowerCase())) {
        leaks.push(`${entry.id}: concept "${entry.concept}" appears in "${entry.prompt}"`);
      }
    }
  }
  expect(leaks).toEqual([]);
  // Non-empty control: the sweep must actually have read banks.
  expect(checkpointFiles().length).toBeGreaterThanOrEqual(7);
});
