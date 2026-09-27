import { describe, expect, it } from 'vitest';
import { emptyProgress } from '@/data/reduce';
import { SECTIONS } from '@/path/curriculum';
import { THEME_LESSON } from '@/review/errorLog';
import { LATER_ON_THE_PATH, bandVerdict, reachedUnit, siteOfLesson, siteOfUnit, verdictAt } from './band';

/** A learner who has passed every unit up to and including `through`. */
function progressThrough(through: string) {
  const p = emptyProgress();
  for (const s of SECTIONS) {
    for (const u of s.units) {
      p.units[u.id] = { passed: true, attempts: 1, failedAttempts: 0, testedOut: false };
      if (u.id === through) return p;
    }
  }
  throw new Error(`no unit ${through}`);
}

describe('where things sit in the curriculum', () => {
  it('places a lesson in the section that declares it', () => {
    expect(siteOfLesson('1.2.4')?.section).toBe('1');
    expect(siteOfLesson('2.2.1')?.section).toBe('2');
    expect(siteOfLesson('4.1.1')?.section).toBe('4');
  });

  it('places a unit, and returns null for one that does not exist', () => {
    expect(siteOfUnit('2.1')?.sectionIndex).toBe(1);
    // The positive control for the null: the SAME query shape finds a real unit,
    // so the null below is an answer about the id and not about the lookup.
    expect(siteOfUnit('99.9')).toBeNull();
  });
});

describe('the band a learner has reached', () => {
  it('is the unit of the path’s active node for a learner who has just started', () => {
    expect(reachedUnit(emptyProgress())).toBe('1.1');
  });

  it('moves with the learner', () => {
    // Having passed 1.6, the next active node is the first lesson of 2.1.
    expect(reachedUnit(progressThrough('1.6'))).toBe('2.1');
    expect(reachedUnit(progressThrough('2.8'))).toBe('3.1');
  });

  it('is the last unit of the last section when everything is passed', () => {
    const last = SECTIONS[SECTIONS.length - 1];
    const lastUnit = last?.units[last.units.length - 1];
    expect(reachedUnit(progressThrough(lastUnit?.id ?? ''))).toBe(lastUnit?.id);
  });
});

describe('F-TS-2: a weakness above the learner’s band is not drilled', () => {
  it('drills a Section 1 idea for a Section 1 learner', () => {
    const v = bandVerdict({ lessonId: '1.2.4' }, '1.2');
    expect(v).toEqual({ drill: true, lessonId: '1.2.4', section: '1' });
  });

  it('refuses a Section 4 idea for a Section 2 learner, with F-TS-2’s wording', () => {
    const v = bandVerdict({ lessonId: '4.1.1' }, '2.1');
    expect(v).toEqual({
      drill: false,
      reason: 'later-on-the-path',
      note: LATER_ON_THE_PATH,
      section: '4',
    });
  });

  it('drills that same Section 4 idea once the learner reaches Section 4', () => {
    // The other direction. Same weakness, same function, one argument changed:
    // without this the refusal above would also pass for a rule that refuses
    // everything.
    expect(bandVerdict({ lessonId: '4.1.1' }, '4.1').drill).toBe(true);
  });

  it('drills at the boundary: the learner’s own section is in band, the next one is not', () => {
    // A Section 2 learner, at the boundary in both directions.
    expect(bandVerdict({ lessonId: '2.2.1' }, '2.1').drill).toBe(true);
    expect(bandVerdict({ lessonId: '3.1.1' }, '2.8').drill).toBe(false);
    // And one unit later the learner is in Section 3, so 3.1.1 is in band.
    expect(bandVerdict({ lessonId: '3.1.1' }, '3.1').drill).toBe(true);
  });

  it('treats an unplaceable learner as the first section rather than as every section', () => {
    expect(bandVerdict({ lessonId: '1.2.4' }, null).drill).toBe(true);
    expect(bandVerdict({ lessonId: '2.2.1' }, null)).toMatchObject({ reason: 'later-on-the-path' });
    // A reached unit that no longer exists is the same conservative case.
    expect(bandVerdict({ lessonId: '2.2.1' }, '99.9')).toMatchObject({ reason: 'later-on-the-path' });
  });

  it('says so when no lesson teaches the theme, rather than drilling nothing quietly', () => {
    expect(bandVerdict({ lessonId: null }, '2.1')).toEqual({
      drill: false,
      reason: 'no-lesson',
      note: 'no lesson teaches this yet',
    });
  });

  it('says so when the lesson id has drifted out of the curriculum', () => {
    expect(bandVerdict({ lessonId: '9.9.9' }, '2.1')).toMatchObject({ reason: 'not-in-curriculum' });
  });

  it('refuses an in-band weakness whose unit has no content yet', () => {
    // Every shipped unit is built, so this branch is reached with a synthetic
    // site. The positive control is the line below it: the same site, built.
    const unbuilt = {
      section: '2',
      sectionIndex: 1,
      unit: { id: '2.9', title: 'Not written', built: false, lessons: [{ id: '2.9.1', title: 'x' }] },
    };
    expect(verdictAt(unbuilt, '2.9.1', 1)).toMatchObject({ reason: 'content-coming', section: '2' });
    expect(verdictAt({ ...unbuilt, unit: { ...unbuilt.unit, built: true } }, '2.9.1', 1).drill).toBe(true);
  });

  it('band takes precedence over content: an out-of-band unbuilt unit reads as later on the path', () => {
    // The learner is owed the remedy that is true. "Keep going" is true for a
    // Section 4 idea at a Section 2 learner whether or not it has been authored.
    const unbuilt = {
      section: '4',
      sectionIndex: 3,
      unit: { id: '4.13', title: 'Not written', built: false, lessons: [{ id: '4.13.1', title: 'x' }] },
    };
    expect(verdictAt(unbuilt, '4.13.1', 1)).toMatchObject({ reason: 'later-on-the-path' });
  });
});

describe('every theme the tagger can name resolves in the curriculum', () => {
  it('has a lesson in a section, so no weakness is refused for drift', () => {
    const mapped = Object.values(THEME_LESSON).filter((id): id is string => id !== null);
    expect(mapped.length).toBeGreaterThan(0);
    for (const id of mapped) {
      expect(siteOfLesson(id), `lesson ${id}`).not.toBeNull();
    }
  });

  it('records where those lessons live, because it decides who can be drilled', () => {
    // All four sit in Section 1 today, so the band rule never refuses a taggable
    // weakness for a learner past Section 1. That is a fact about the tagger's
    // coverage, not about the rule, and this test is what notices it changing.
    const sections = Object.values(THEME_LESSON)
      .filter((id): id is string => id !== null)
      .map((id) => siteOfLesson(id)?.section);
    expect(new Set(sections)).toEqual(new Set(['1']));
  });
});
