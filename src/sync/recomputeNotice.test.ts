import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  isWorthShowing,
  recomputeNotice,
  type RecomputeReason,
  type RecomputedFigure,
} from './recomputeNotice';

const FIGURES: RecomputedFigure[] = ['puzzle-rating', 'day-streak', 'checkpoint'];
const REASONS: RecomputeReason[] = ['another-device', 'recount', 'correction'];

/** Every combination, so no assertion below can be true of only one branch. */
function every(): { figure: RecomputedFigure; reason: RecomputeReason; before: number; after: number }[] {
  return FIGURES.flatMap((figure) =>
    REASONS.flatMap((reason) => [
      { figure, reason, before: 800, after: 760 }, // down — the hard direction
      { figure, reason, before: 800, after: 840 }, // up
    ]),
  );
}

describe('recomputeNotice (F-ER-7)', () => {
  test('a figure that fell never reads as an error', () => {
    /*
     * This is the whole clause. A rating that drops is the case where the
     * vocabulary of failure is reached for by reflex, so the forbidden words are
     * checked against EVERY figure and EVERY reason in the falling direction, not
     * against one example.
     */
    const forbidden = [
      'error',
      'failed',
      'failure',
      'sorry',
      'problem',
      'wrong',
      'incorrect',
      'mistake',
      'unfortunately',
      'lost',
      'penalt',
      'invalid',
      'could not',
      'unable',
    ];
    for (const r of every().filter((x) => x.after < x.before)) {
      const { text } = recomputeNotice(r);
      for (const word of forbidden) {
        expect(text.toLowerCase(), `${r.figure}/${r.reason}: "${text}"`).not.toContain(word);
      }
    }
  });

  test('the tone is an update, and the type admits nothing else', () => {
    for (const r of every()) {
      expect(recomputeNotice(r).tone).toBe('update');
    }
  });

  test('it is ONE line', () => {
    for (const r of every()) {
      const { text } = recomputeNotice(r);
      expect(text, text).not.toContain('\n');
      // One sentence, one full stop. Two sentences of explanation is not what
      // "a one-line reason" asks for.
      expect(text.split('.').filter((s) => s.trim() !== ''), text).toHaveLength(1);
    }
  });

  test('it states both numbers, so the learner is not left doing the subtraction', () => {
    const { text } = recomputeNotice({
      figure: 'puzzle-rating',
      before: 820,
      after: 780,
      reason: 'recount',
    });
    expect(text).toContain('820');
    expect(text).toContain('780');
  });

  test('it carries a reason, and a different reason gives a different line', () => {
    const lines = REASONS.map(
      (reason) => recomputeNotice({ figure: 'puzzle-rating', before: 800, after: 780, reason }).text,
    );
    expect(new Set(lines).size).toBe(REASONS.length);
    // And every one of them actually says something after the numbers: a reason
    // field that rendered as an empty string would still produce three distinct
    // lines if the figures differed, so the length is checked too.
    for (const line of lines) expect(line.length).toBeGreaterThan(50);
  });

  test('each figure is named in words a learner would recognise, and not by its key', () => {
    for (const figure of FIGURES) {
      const { text } = recomputeNotice({ figure, before: 5, after: 4, reason: 'recount' });
      expect(text).toMatch(/^Your /);
      // No programmer identifier on screen. `not.toContain(figure)` was the
      // obvious form and it is wrong: `checkpoint` is a key AND an ordinary
      // English word, so that assertion would forbid the correct copy while
      // still permitting `day-streak`. The hyphen is what makes a key a key.
      expect(text, text).not.toMatch(/[a-z]-[a-z]/);
    }
    // The control: the keys this is meant to exclude really do look like keys, so
    // the pattern above is not vacuous.
    expect(FIGURES.filter((f) => /[a-z]-[a-z]/.test(f))).toEqual(['puzzle-rating', 'day-streak']);
  });

  test('a streak is counted in days, and one day is not "1 days"', () => {
    expect(recomputeNotice({ figure: 'day-streak', before: 2, after: 1, reason: 'recount' }).text).toContain(
      '1 day,',
    );
    expect(recomputeNotice({ figure: 'day-streak', before: 1, after: 2, reason: 'recount' }).text).toContain(
      '2 days',
    );
  });

  test('a rise is stated in exactly the same register as a fall', () => {
    // F-ER-7's "never as an error" has a mirror: if a rise were celebrated and a
    // fall merely reported, the same event would read differently by direction,
    // which is the asymmetry the clause is half of.
    const down = recomputeNotice({ figure: 'puzzle-rating', before: 800, after: 760, reason: 'recount' }).text;
    const up = recomputeNotice({ figure: 'puzzle-rating', before: 760, after: 800, reason: 'recount' }).text;
    expect(down.replace(/800|760/g, 'N')).toBe(up.replace(/800|760/g, 'N'));
    for (const t of [down, up]) expect(t, t).not.toContain('!');
  });
});

describe('isWorthShowing', () => {
  test('a figure that did not move says nothing', () => {
    expect(isWorthShowing({ figure: 'puzzle-rating', before: 800, after: 800, reason: 'recount' })).toBe(false);
  });

  test('a figure that moved says something, in both directions', () => {
    // The positive control for the line above: this input CAN be true, so a
    // function that always returned false would fail here.
    expect(isWorthShowing({ figure: 'puzzle-rating', before: 800, after: 799, reason: 'recount' })).toBe(true);
    expect(isWorthShowing({ figure: 'puzzle-rating', before: 799, after: 800, reason: 'recount' })).toBe(true);
  });
});

/**
 * THE BLOCKED-ON CLAIM, CHECKED.
 *
 * The header of `recomputeNotice.ts` asserts that no server-side recomputation
 * exists, and that assertion is the entire justification for shipping a rule with
 * no caller. A claim like that rots silently: the day someone adds an edge
 * function, the file's explanation becomes false and nothing else in the repo
 * notices. So it is a test.
 *
 * If this test fails, F-ER-7 is no longer blocked, and the right response is to
 * wire `recomputeNotice` into whatever now recomputes — not to loosen the test.
 */
describe('F-ER-7 is blocked because nothing recomputes server-side', () => {
  const root = resolve(__dirname, '../..');

  test('the only database function is the profile trigger', () => {
    const dir = resolve(root, 'supabase/migrations');
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => readFileSync(resolve(dir, f), 'utf8'))
      .join('\n');
    // The positive control: the walk found real SQL, so the absences below are
    // statements about the migrations and not about an empty read.
    expect(sql.length).toBeGreaterThan(200);
    expect(sql).toMatch(/create or replace function public\.handle_new_user/);

    const functions = [...sql.matchAll(/create (?:or replace )?function\s+([\w.]+)/gi)].map((m) => m[1]);
    expect(functions).toEqual(['public.handle_new_user']);
  });

  test('there are no edge functions and no scheduled jobs', () => {
    expect(existsSync(resolve(root, 'supabase/functions'))).toBe(false);
    const dir = resolve(root, 'supabase/migrations');
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => readFileSync(resolve(dir, f), 'utf8'))
      .join('\n');
    // pg_cron or pg_net would be how a Postgres-only deployment recomputed on a
    // schedule or called out to something that did.
    expect(sql).not.toMatch(/pg_cron|cron\.schedule|pg_net/i);
  });

  test('the sync layer moves rows and computes no figure', () => {
    const sync = ['flush.ts', 'merge.ts']
      .map((f) => readFileSync(resolve(__dirname, f), 'utf8'))
      .join('\n');
    expect(sync.length).toBeGreaterThan(500); // the read worked
    // An RPC is how a client would ask a server to compute something.
    expect(sync).not.toMatch(/\.rpc\(/);
    // And nothing in sync reaches the modules that derive the three figures.
    expect(sync).not.toMatch(/nextRating|streakOf|puzzles\/rating|engagement\/streak/);
  });
});
