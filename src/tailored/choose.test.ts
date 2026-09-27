import { describe, expect, it } from 'vitest';
import type { Weakness } from '@/profile';
import { bandVerdict } from './band';
import { chooseTarget, reasonFor } from './choose';

function aWeakness(over: Partial<Weakness> & { name: string; lessonId: string | null }): Weakness {
  return {
    theme: 'unclassified',
    occurrences: 9,
    games: 20,
    cost: 1,
    weightedOccurrences: 9,
    meanExpectedScoreLost: 0.1,
    typicalForLevel: { known: false },
    lessonTitle: 'A lesson',
    drill: null,
    ...over,
  };
}

/** Section 1's "Do not leave pieces free" and "All checks and captures". */
const HUNG = aWeakness({ name: 'Leaving pieces free to take', lessonId: '1.2.4', cost: 9, theme: 'hung_piece' });
const THREAT = aWeakness({ name: 'Ignoring your opponent’s threat', lessonId: '1.6.2', cost: 4, theme: 'ignored_threat' });
/** A Section 4 idea, for the out-of-band case. */
const CLUB = aWeakness({ name: 'Deflection', lessonId: '4.1.1', cost: 99 });
/** Shares HUNG's lesson, for the combining case. */
const SAME_LESSON = aWeakness({ name: 'Counting attackers', lessonId: '1.2.4', cost: 3 });

describe('F-TS-2: choosing the target', () => {
  it('takes the first drillable weakness in the order it was given', () => {
    const c = chooseTarget({ weaknesses: [HUNG, THREAT], reached: '1.6' });
    expect(c.target?.primary.name).toBe(HUNG.name);
    expect(c.target?.lessonId).toBe('1.2.4');
    expect(c.noTarget).toBeNull();
  });

  it('does not re-rank: a cheaper weakness first in the list is chosen first', () => {
    // The profile owns the ranking (F-SW-3). If this function sorted by `cost` it
    // would pick HUNG here, and the two rankings would be free to disagree.
    const c = chooseTarget({ weaknesses: [THREAT, HUNG], reached: '1.6' });
    expect(c.target?.primary.name).toBe(THREAT.name);
    expect(c.deferred).toEqual([]);
  });

  it('skips a weakness above the band and drills the next one down the list', () => {
    const c = chooseTarget({ weaknesses: [CLUB, HUNG], reached: '2.1' });
    expect(c.target?.primary.name).toBe(HUNG.name);
    expect(c.deferred).toHaveLength(1);
    expect(c.deferred[0]?.reason).toBe('later-on-the-path');
    expect(c.deferred[0]?.note).toBe('later on the path');
  });

  it('offers no session at all when every weakness is above the band', () => {
    const c = chooseTarget({ weaknesses: [CLUB], reached: '2.1' });
    expect(c.target).toBeNull();
    expect(c.noTarget).toContain('later on the path');
    // The other direction: the same weakness at the right band DOES yield a target,
    // so the null above is the band rule and not a list the chooser cannot read.
    expect(chooseTarget({ weaknesses: [CLUB], reached: '4.1' }).target).not.toBeNull();
  });

  it('says so, distinctly, when there are no weaknesses at all', () => {
    const c = chooseTarget({ weaknesses: [], reached: '1.6' });
    expect(c.target).toBeNull();
    expect(c.noTarget).toBe('There are no weaknesses to work on yet.');
  });

  it('says so when a weakness has no lesson rather than blaming the band', () => {
    const nameless = aWeakness({ name: 'Mistakes with no pattern yet identified', lessonId: null });
    const c = chooseTarget({ weaknesses: [nameless], reached: '1.6' });
    expect(c.target).toBeNull();
    expect(c.noTarget).toBe('Nothing in the profile has a lesson to drill yet.');
    expect(c.deferred[0]?.reason).toBe('no-lesson');
  });

  it('combines two weaknesses that share a lesson', () => {
    const c = chooseTarget({ weaknesses: [HUNG, SAME_LESSON, THREAT], reached: '1.6' });
    expect(c.target?.alsoCovers?.name).toBe(SAME_LESSON.name);
    expect(c.target?.reason).toContain('one lesson covers both');
  });

  it('does not combine weaknesses that map to different lessons', () => {
    const c = chooseTarget({ weaknesses: [HUNG, THREAT], reached: '1.6' });
    expect(c.target?.alsoCovers).toBeNull();
  });

  it('cannot smuggle an out-of-band idea in through the combination', () => {
    // Combining does not re-check the band, because it cannot matter: two
    // weaknesses on the same lesson get the same verdict. This pins that property,
    // which is what makes the missing check safe rather than lucky.
    const outOfBandSameLesson = aWeakness({ name: 'Later idea', lessonId: '4.1.1' });
    const club = aWeakness({ name: 'Deflection', lessonId: '4.1.1', cost: 99 });
    // Section 2: neither is drilled, so there is no target to combine onto.
    expect(chooseTarget({ weaknesses: [club, outOfBandSameLesson], reached: '2.1' })).toMatchObject({ target: null });
    expect(bandVerdict(club, '2.1')).toEqual(bandVerdict(outOfBandSameLesson, '2.1'));
    // Section 4: both are in band, and they combine.
    expect(chooseTarget({ weaknesses: [club, outOfBandSameLesson], reached: '4.1' }).target?.alsoCovers?.name).toBe(
      'Later idea',
    );
  });

  it('never combines a weakness with itself', () => {
    const c = chooseTarget({ weaknesses: [HUNG], reached: '1.6' });
    expect(c.target?.alsoCovers).toBeNull();
  });

  it('lists every deferred weakness, not just the first', () => {
    const other = aWeakness({ name: 'Another later idea', lessonId: '4.2.1' });
    const c = chooseTarget({ weaknesses: [CLUB, other], reached: '1.6' });
    expect(c.deferred.map((d) => d.weakness.name)).toEqual([CLUB.name, other.name]);
  });
});

describe('F-TS-2’s one sentence', () => {
  it('names the weakness and the numbers the profile shows', () => {
    expect(reasonFor(HUNG, null)).toBe(
      'Today is about leaving pieces free to take: 9 times in 20 games, and it costs you more than anything else.',
    );
  });

  it('agrees in number for a single occurrence', () => {
    const once = aWeakness({ name: 'Missing mate in one', lessonId: '1.3.3', occurrences: 1, games: 1 });
    expect(reasonFor(once, null)).toContain('1 time in 1 game');
  });

  it('names both when two weaknesses are combined', () => {
    const s = reasonFor(HUNG, THREAT);
    expect(s).toContain('leaving pieces free to take');
    expect(s).toContain('ignoring your opponent’s threat');
  });
});
