import { useEffect, useState } from 'react';
import { db } from '@/data/db';
import { localDay, type LearnerEvent } from '@/data/events';
import { onEventAppended } from '@/data/store';
import { useOnboarding } from '@/onboarding/store';
import type { DailyGoal } from '@/onboarding/types';
import { achievementsFrom, type Achievement } from './achievements';
import { unlockedCosmetics, type CosmeticTheme } from './cosmetics';
import { qualifyingDayIndex, type QualifyingKind } from './qualifying';
import { freezeGrantDays, questCredits, questsOn, weeklyQuestOn, type DayQuests, type WeeklyQuest } from './quests';
import { noStreak, streakOn, type Streak } from './streak';

/**
 * The engagement layer's one composition point (PRD 8.9).
 *
 * Every part of F-EN is a pure projection of `(events, now)` and each lives in its
 * own file with its own tests. This file is the only place they are joined, and it
 * is deliberately thin: it decides the ORDER — the streak needs the freezes the
 * weekly quest grants, the cosmetics need the achievements and the quest credits,
 * the achievements need the best streak — and computes nothing itself.
 *
 * `engagementFrom` takes the clock as an argument. `useEngagement` is the only
 * thing in the layer that reads one, and it reads it once per load.
 */

export interface Engagement {
  /** The local day the projection was taken on. */
  today: string;
  streak: Streak;
  /** F-EN-1's six kinds, for the day, so the card can say what was done. */
  doneToday: QualifyingKind[];
  quests: DayQuests;
  weekly: WeeklyQuest;
  achievements: Achievement[];
  questCredits: number;
  /** The cosmetics the learner holds. F-EN-6. */
  cosmetics: CosmeticTheme[];
}

export function emptyEngagement(today: string): Engagement {
  return {
    today,
    streak: noStreak(),
    doneToday: [],
    quests: questsOn([], today),
    weekly: weeklyQuestOn([], 10, today),
    achievements: achievementsFrom({ events: [], bestStreakDays: 0 }),
    questCredits: 0,
    cosmetics: unlockedCosmetics({ achievements: [], questCredits: 0 }),
  };
}

export function engagementFrom(events: readonly LearnerEvent[], goal: DailyGoal, now: Date): Engagement {
  const today = localDay(now);

  // ORDER, and why it is this order:
  //   1. the qualifying days and the freeze grants are both read from the log;
  //   2. the streak consumes both (F-EN-1's freezes come from F-EN-3);
  //   3. the achievements consume the streak's BEST length (F-EN-5's 30 days);
  //   4. the cosmetics consume the achievements and the quest credits (F-EN-6).
  // Nothing later feeds anything earlier, so there is no cycle to break.
  const index = qualifyingDayIndex(events);
  const streak = streakOn({
    qualifyingDays: [...index.keys()],
    freezeGrantDays: freezeGrantDays(events, goal),
    today,
  });
  const credits = questCredits(events, today);
  const achievements = achievementsFrom({ events, bestStreakDays: streak.bestDays });

  return {
    today,
    streak,
    doneToday: index.get(today) ?? [],
    quests: questsOn(events, today),
    weekly: weeklyQuestOn(events, goal, today),
    achievements,
    questCredits: credits,
    cosmetics: unlockedCosmetics({ achievements, questCredits: credits }),
  };
}

/**
 * The engagement projection, read from the event log.
 *
 * One Dexie read and one pure call, the same shape as `profile/useProfile.ts`.
 * There is no engagement table: a streak stored as a number is a number that can
 * disagree with the log, which is the whole reason F-EN-1 is a reducer.
 *
 * An unreadable Dexie renders the empty projection rather than taking the screen
 * down, again matching `useProfile`: a learner with no log sees the same thing.
 */
export function useEngagement(): Engagement {
  const goal = useOnboarding((s) => s.dailyGoal);
  const [state, setState] = useState<Engagement>(() => emptyEngagement(localDay(new Date())));

  useEffect(() => {
    let live = true;
    const read = () => {
      db.events
        .toArray()
        .then((events) => {
          if (live) setState(engagementFrom(events, goal, new Date()));
        })
        .catch(() => {
          if (live) setState(emptyEngagement(localDay(new Date())));
        });
    };
    read();
    // Re-read on every append. A streak that only updated on remount would tell a
    // learner who just finished a lesson on this screen that they have not done
    // anything today, which is the one thing the card must never say.
    const stop = onEventAppended(() => {
      read();
    });
    return () => {
      live = false;
      stop();
    };
  }, [goal]);

  return state;
}
