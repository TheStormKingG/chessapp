import { describe, expect, it } from 'vitest';
import { GOAL_OPTIONS } from '@/onboarding/types';
import { MAX_SET, MIN_SET } from './practiceSet';
import { offerDecision, sizeFor } from './buildSession';
import { shiftDay } from './schedule';
import type { TakenSession } from './store';

const TODAY = '2026-09-26';
const SIG = 'sig-now';
const took = (day: string, signature = 'older'): TakenSession => ({ day, theme: 't', lessonId: '1.2.4', signature });

const base = {
  signature: SIG,
  declined: null,
  taken: [] as TakenSession[],
  today: TODAY,
  firstSessionDue: true,
  hasTarget: true,
};

describe('F-TS-1: sized to the daily goal', () => {
  it('stays inside F-TS-4’s six to ten for every goal the app offers', () => {
    for (const option of GOAL_OPTIONS) {
      const s = sizeFor(option.value);
      expect(s.puzzles, `goal ${String(option.value)}`).toBeGreaterThanOrEqual(MIN_SET);
      expect(s.puzzles, `goal ${String(option.value)}`).toBeLessThanOrEqual(MAX_SET);
    }
  });

  it('grows with the goal', () => {
    expect(sizeFor(5).puzzles).toBeLessThan(sizeFor(10).puzzles);
    expect(sizeFor(10).puzzles).toBeLessThan(sizeFor(15).puzzles);
    expect(sizeFor(15).puzzles).toBeLessThan(sizeFor(20).puzzles);
  });

  it('does not promise a bot game inside a five-minute goal', () => {
    expect(sizeFor(5).game).toBe('optional');
    expect(sizeFor(10).game).toBe('included');
  });
});

describe('F-TS-1: when a session is offered', () => {
  it('offers one when the profile has changed materially', () => {
    expect(offerDecision(base)).toMatchObject({ offered: true, reason: 'profile-changed' });
  });

  it('offers nothing when no weakness is in band', () => {
    expect(offerDecision({ ...base, hasTarget: false })).toMatchObject({ offered: false, reason: 'no-target' });
  });

  it('waits for F-TS-7’s gate', () => {
    expect(offerDecision({ ...base, firstSessionDue: false })).toMatchObject({ offered: false, reason: 'too-early' });
  });

  it('does not re-offer what the learner declined', () => {
    expect(offerDecision({ ...base, declined: SIG })).toMatchObject({ offered: false, reason: 'declined' });
    // A DIFFERENT offer is still made: declining one is not opting out of the feature.
    expect(offerDecision({ ...base, declined: 'sig-old' }).offered).toBe(true);
  });

  it('does not re-offer a session the learner has already done for this profile', () => {
    const taken = [took(shiftDay(TODAY, -3), SIG)];
    expect(offerDecision({ ...base, taken })).toMatchObject({ offered: false, reason: 'unchanged' });
    // Control: the same history with a different signature does offer.
    expect(offerDecision({ ...base, taken: [took(shiftDay(TODAY, -3), 'other')] }).offered).toBe(true);
  });

  it('stops at twice a week, and says which day it frees up', () => {
    const taken = [took(shiftDay(TODAY, -1)), took(shiftDay(TODAY, -6))];
    const d = offerDecision({ ...base, taken });
    expect(d).toMatchObject({ offered: false, reason: 'quota-reached' });
    expect(d.swap.nextEligibleDay).toBe(shiftDay(TODAY, 1));
  });

  it('does not offer a second session on a day that already has one', () => {
    expect(offerDecision({ ...base, taken: [took(TODAY)] })).toMatchObject({
      offered: false,
      reason: 'already-today',
    });
  });
});

describe('F-TS-1: “Train on this” is the learner asking', () => {
  it('is granted even when the weekly quota is used up', () => {
    // The cap in F-TS-1 governs the DAILY PLAN's swap, not the profile screen's
    // button. Documented in buildSession.ts; pinned here so the reading is visible.
    const taken = [took(shiftDay(TODAY, -1)), took(shiftDay(TODAY, -2))];
    expect(offerDecision({ ...base, taken })).toMatchObject({ offered: false, reason: 'quota-reached' });
    expect(offerDecision({ ...base, taken, onDemand: true })).toMatchObject({ offered: true, reason: 'on-demand' });
  });

  it('does not get past F-TS-7’s gate: the feature is not open yet', () => {
    // The quota is the plan's rule and the button may ignore it; the ten-game gate is
    // about whether there is enough evidence to build a session at all, so it is not
    // the learner's to waive.
    expect(offerDecision({ ...base, firstSessionDue: false, onDemand: true })).toMatchObject({
      offered: false,
      reason: 'too-early',
    });
  });

  it('is still refused twice in one day', () => {
    expect(offerDecision({ ...base, taken: [took(TODAY)], onDemand: true })).toMatchObject({
      offered: false,
      reason: 'already-today',
    });
  });

  it('is refused when there is nothing in band to train on', () => {
    expect(offerDecision({ ...base, hasTarget: false, onDemand: true })).toMatchObject({
      offered: false,
      reason: 'no-target',
    });
  });
});
