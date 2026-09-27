import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSettings } from '@/app/settings';
import { db } from '@/data/db';
import { newEvent, type EventPayload, type LearnerEvent } from '@/data/events';
import { AchievementShowcase } from './AchievementShowcase';
import { CosmeticsPicker } from './CosmeticsPicker';
import { QuestList } from './QuestList';
import { ReminderControl } from './ReminderControl';
import { StreakCard } from './StreakCard';
import { achievementsFrom } from './achievements';
import { COSMETICS } from './cosmetics';
import { questsOn, weeklyQuestOn } from './quests';
import { streakOn } from './streak';
import { resolveCosmetics } from './useCosmetics';

const DEFAULT_SETTINGS = {
  remindPush: false,
  remindEmail: false,
  boardCosmetic: null,
  piecesCosmetic: null,
};

beforeEach(async () => {
  await db.events.clear();
  useSettings.setState(DEFAULT_SETTINGS);
  document.documentElement.style.cssText = '';
});
afterEach(() => {
  cleanup();
});

function ev(payload: EventPayload, day: string, hour = 12): LearnerEvent {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return newEvent(payload, new Date(y, m - 1, d, hour));
}

const lesson = (day: string, id = '1.1.1') =>
  ev({ type: 'lesson_completed', lessonId: id, stars: 3, xp: 14, replay: false }, day);

/* ------------------------------------------------------- F-EN-1 on the screen */

test('a learner with no streak is not told they have lost anything', () => {
  render(<StreakCard streak={streakOn({ qualifyingDays: [], freezeGrantDays: [], today: '2026-05-20' })} />);
  expect(screen.getByText(/your streak starts/i)).toBeInTheDocument();
  expect(screen.queryByTestId('streak-days')).toBeNull();
});

test('the streak is stated in days, with the freezes held', () => {
  const streak = streakOn({
    qualifyingDays: ['2026-05-18', '2026-05-19', '2026-05-20'],
    freezeGrantDays: ['2026-05-15'],
    today: '2026-05-20',
  });
  render(<StreakCard streak={streak} />);
  expect(screen.getByTestId('streak-days')).toHaveTextContent('3 days in a row');
  expect(screen.getByTestId('streak-days')).toHaveTextContent('1 freeze held');
  expect(screen.getByTestId('streak-status')).toHaveTextContent(/Today is counted/);
});

test('a paused streak names the day that saves it and counts no missed days', () => {
  const streak = streakOn({ qualifyingDays: ['2026-05-18'], freezeGrantDays: [], today: '2026-05-20' });
  expect(streak.status).toBe('paused');
  render(<StreakCard streak={streak} />);
  const status = screen.getByTestId('streak-status');
  expect(status).toHaveTextContent(/Paused/);
  expect(status).toHaveTextContent('2026-05-21');
  expect(status.textContent ?? '').not.toMatch(/missed|lost|failed|broken/i);
  // Positive control: that regex does match a line that deserves it, so the
  // assertion above is about the copy and not a filter that matches nothing.
  expect(/missed|lost|failed|broken/i.test('You missed a day and your streak is broken')).toBe(true);
});

test('a milestone day says so, and an ordinary day does not', () => {
  const days = (n: number) =>
    streakOn({
      qualifyingDays: Array.from({ length: n }, (_, i) => `2026-05-${String(20 - (n - 1 - i)).padStart(2, '0')}`),
      freezeGrantDays: [],
      today: '2026-05-20',
    });
  render(<StreakCard streak={days(7)} />);
  expect(screen.getByTestId('streak-milestone')).toHaveTextContent('7 days');
  cleanup();
  render(<StreakCard streak={days(8)} />);
  expect(screen.queryByTestId('streak-milestone')).toBeNull();
});

/* ------------------------------------------------------- F-EN-3 on the screen */

test('three daily quests and the weekly one are shown with their progress', () => {
  const day = '2026-05-20';
  const events = [lesson(day)];
  const quests = questsOn(events, day);
  render(<QuestList quests={quests} weekly={weeklyQuestOn(events, 10, day)} />);
  for (const q of quests.quests) {
    expect(screen.getByTestId(`quest-${q.id}`)).toBeInTheDocument();
  }
  expect(quests.quests).toHaveLength(3);
  expect(screen.getByTestId('quest-weekly')).toHaveTextContent(/streak freeze/);
  // Something really is in progress, so the list is not three empty rows.
  expect(quests.quests.some((q) => q.done)).toBe(true);
});

/* ------------------------------------------------------- F-EN-5 on the profile */

test('the showcase separates earned, still to come, and not in this release', () => {
  const all = achievementsFrom({ events: [], bestStreakDays: 0 });
  render(<AchievementShowcase achievements={all} />);
  expect(screen.queryByTestId('achievements-earned')).toBeNull();
  expect(screen.getByTestId('achievements-to-come')).toBeInTheDocument();
  expect(screen.getByTestId('achievements-blocked')).toBeInTheDocument();
  expect(screen.getByText(/rather than for how much you do/i)).toBeInTheDocument();

  // And with something earned, the earned list appears — the positive control for
  // the null above.
  cleanup();
  render(<AchievementShowcase achievements={all.map((a) => (a.id === 'first-checkpoint' ? { ...a, unlocked: true } : a))} />);
  expect(screen.getByTestId('achievements-earned')).toHaveTextContent('First checkpoint');
});

/* ------------------------------------------------------- F-EN-6 in settings */

test('a locked cosmetic is shown, disabled, and says what earns it', async () => {
  render(<CosmeticsPicker />);
  const locked = COSMETICS.filter((c) => c.unlock !== null);
  expect(locked.length).toBeGreaterThan(0);
  await waitFor(() => {
    expect(screen.getByTestId(`cosmetic-${locked[0]?.id ?? ''}`)).toBeInTheDocument();
  });
  for (const c of locked) {
    const row = screen.getByTestId(`cosmetic-${c.id}`);
    expect(row.querySelector('input')?.disabled, c.id).toBe(true);
  }
  // The two free entries are selectable, which is the control that "disabled" is a
  // property of being locked.
  for (const c of COSMETICS.filter((x) => x.unlock === null)) {
    expect(screen.getByTestId(`cosmetic-${c.id}`).querySelector('input')?.disabled).toBe(false);
  }
  expect(screen.getByText(/Nothing here changes a lesson/i)).toBeInTheDocument();
});

test('resolveCosmetics drops an id the learner does not hold, and one that no longer exists', () => {
  const none = { achievements: achievementsFrom({ events: [], bestStreakDays: 0 }), questCredits: 0 };
  expect(resolveCosmetics({ boardId: 'board-moss', piecesId: null }, none)).toEqual([]);
  expect(resolveCosmetics({ boardId: 'board-from-a-past-release', piecesId: null }, none)).toEqual([]);
  // Held: the same id resolves. Without this the empty arrays above could be a
  // function that always returns nothing.
  const held = {
    achievements: none.achievements.map((a) => (a.id === 'full-section' ? { ...a, unlocked: true } : a)),
    questCredits: 0,
  };
  expect(resolveCosmetics({ boardId: 'board-moss', piecesId: null }, held).map((c) => c.id)).toEqual(['board-moss']);
});

test('a pair that fails the piece rule is not applied at all', () => {
  // Guard 2 in `useCosmetics.ts`. Exercised through the real catalogue by asking
  // for a kind mismatch, which resolves to nothing, and then by a held pair, which
  // resolves to both.
  const held = {
    achievements: achievementsFrom({ events: [], bestStreakDays: 0 }).map((a) =>
      a.id === 'full-section' || a.id === 'clean-game' ? { ...a, unlocked: true } : a,
    ),
    questCredits: 0,
  };
  expect(resolveCosmetics({ boardId: 'pieces-ivory', piecesId: null }, held)).toEqual([]);
  expect(resolveCosmetics({ boardId: 'board-moss', piecesId: 'pieces-ivory' }, held).map((c) => c.id)).toEqual([
    'board-moss',
    'pieces-ivory',
  ]);
});

/* ------------------------------------------------------- F-EN-7 in settings */

describe('the reminder control', () => {
  const original = globalThis.Notification;
  let asked = 0;

  beforeEach(() => {
    asked = 0;
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      writable: true,
      value: {
        permission: 'default' as NotificationPermission,
        requestPermission: () => {
          asked += 1;
          return Promise.resolve('granted' as NotificationPermission);
        },
      },
    });
  });
  afterEach(() => {
    if (original === undefined) Reflect.deleteProperty(globalThis, 'Notification');
    else Object.defineProperty(globalThis, 'Notification', { value: original, configurable: true, writable: true });
  });

  test('RENDERING the control never raises the permission prompt', async () => {
    // The least reversible thing this app can do to a learner. A mount, an effect
    // and a Dexie read all happen here; none of them may ask.
    await db.events.bulkAdd([lesson('2026-05-19'), lesson('2026-05-20', '1.1.2')]);
    render(<ReminderControl />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /allow reminders/i })).toBeInTheDocument();
    });
    expect(asked).toBe(0);
  });

  test('the prompt is raised by the tap, and only by the tap', async () => {
    await db.events.bulkAdd([lesson('2026-05-19'), lesson('2026-05-20', '1.1.2')]);
    render(<ReminderControl />);
    const button = await waitFor(() => screen.getByRole('button', { name: /allow reminders/i }));
    expect(asked).toBe(0);
    await userEvent.click(button);
    await waitFor(() => {
      expect(asked).toBe(1);
    });
  });

  test('with one day of activity the control is not offered, and nothing is asked', async () => {
    await db.events.bulkAdd([lesson('2026-05-20')]);
    render(<ReminderControl />);
    await waitFor(() => {
      expect(screen.getByText(/couple of days of practice/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /allow reminders/i })).toBeNull();
    expect(asked).toBe(0);
  });

  test('each channel is one switch, and turning it off is that one tap', async () => {
    render(<ReminderControl />);
    const push = screen.getByRole('checkbox', { name: /remind me here/i });
    const email = screen.getByRole('checkbox', { name: /remind me by email/i });
    expect(push).not.toBeChecked();
    expect(email).not.toBeChecked();
    await userEvent.click(push);
    expect(useSettings.getState().remindPush).toBe(true);
    await userEvent.click(push);
    expect(useSettings.getState().remindPush).toBe(false);
    // The second channel is independent, which is what "each channel" means.
    await userEvent.click(email);
    expect(useSettings.getState().remindEmail).toBe(true);
    expect(useSettings.getState().remindPush).toBe(false);
  });

  test('the screen says plainly that nothing is being delivered yet', () => {
    render(<ReminderControl />);
    expect(screen.getByText(/not being delivered yet/i)).toBeInTheDocument();
  });
});
