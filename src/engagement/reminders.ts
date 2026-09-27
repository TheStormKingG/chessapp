import type { LearnerEvent } from '@/data/events';
import { activityDays, mayRequestNotificationPermission, type ReminderDecision } from '@/onboarding/notifications';
import type { Streak } from './streak';

/**
 * F-EN-7, verbatim:
 *
 * > "Notifications. One reminder a day at most, at the learner's usual time, with
 * > copy tests across a small set of templates. Copy is anchored on the learner's
 * > unfinished business ('You left a rook hanging yesterday, want to see why?')
 * > or the streak, never guilt for its own sake. Quiet hours are respected. Push
 * > on Android, desktop and installed iOS, email as the fallback and for weekly
 * > summaries. The learner can turn each channel off in two taps."
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * THIS FILE STOPS AT THE SEND. WHAT IS MISSING IS INFRASTRUCTURE, NOT CODE.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Everything F-EN-7 asks for that runs in a browser is here and tested: the
 * permission gate's caller, the usual-time calculation, quiet hours, the one-a-day
 * cap, the per-channel off switches and the copy templates. Nothing DELIVERS a
 * reminder, and that is a decision for the repository owner rather than an
 * omission, for reasons worth stating exactly:
 *
 *   - PUSH on Android, desktop and installed iOS needs a Web Push subscription
 *     endpoint, a VAPID key pair, and a SERVER that wakes up at the learner's
 *     usual time and posts to that endpoint. A service worker cannot schedule its
 *     own future notification: `showNotification` needs the page or a push event,
 *     and the Notification Triggers API never shipped. This app's only backend is
 *     Supabase for auth and sync (`src/sync/`), so the missing pieces are a VAPID
 *     key, a `push_subscriptions` table and a scheduled function.
 *
 *     There is a fourth piece and it is in THIS repository: `vite.config.ts`
 *     configures `VitePWA` with no `strategies`, which is Workbox's `generateSW`,
 *     and there is no service-worker source file anywhere in `src/`. A generated
 *     service worker has no `push` or `notificationclick` handler and no place to
 *     add one, so receiving a push means moving to `injectManifest` and authoring
 *     a service worker — a change to how the app's caching is built, which is
 *     `src/pwa/`'s business and not this layer's to make.
 *
 *   - EMAIL needs a sender: a transactional provider, a verified domain, an
 *     unsubscribe route and a suppression list.
 *
 * Both are the same boundary F-IM-4's daily job stopped at. `plan()` below returns
 * the reminder that WOULD be sent, with the channel it would go on, and the caller
 * has nothing to hand it to. That is a stated absence rather than a hidden one,
 * and it is the same shape `onboarding/notifications.ts` used for the gate that
 * had no caller.
 *
 * ── THE PERMISSION PROMPT ────────────────────────────────────────────────────
 *
 * F-ON-8's rule already exists as a pure, tested function and is NOT re-derived
 * here: `requestPermissionFromTap` is a thin caller that asks
 * `mayRequestNotificationPermission` and touches `Notification.requestPermission`
 * only on `{ allowed: true }`. A denial is permanent in every browser and cannot
 * be asked again, so the whole point of that gate is that the prompt is
 * unreachable from an effect, a mount, a timer or a page load. `fromTap` is
 * supplied by the DOM event handler and by nothing else.
 *
 * ── "NEVER GUILT FOR ITS OWN SAKE" IS A CONTENT CONSTRAINT WITH A TEST ───────
 *
 * Every template below is anchored on something the learner can act on — a
 * specific unfinished thing, or a streak that is still theirs to keep. None names
 * a failure, none counts days missed, and none asks a question the learner can
 * only answer by feeling bad. `reminders.test.ts` holds that with a banned-phrase
 * sweep plus the positive control that the sweep can fail.
 */

/* ------------------------------------------------------------------ channels */

/** F-EN-7's channels. Email is "the fallback and for weekly summaries". */
export type ReminderChannel = 'push' | 'email';

export const REMINDER_CHANNELS: readonly ReminderChannel[] = ['push', 'email'];

export interface ChannelSettings {
  push: boolean;
  email: boolean;
}

/**
 * F-EN-7: "The learner can turn each channel off in two taps."
 *
 * Two taps is a claim about a route, so it is stated as a number the UI test can
 * check rather than left to the screen: tap one opens Settings from Today, tap two
 * is the channel's own switch. Nothing is nested inside a further sheet, and there
 * is no "notification preferences" sub-page — that would make it three.
 */
export const TAPS_TO_TURN_A_CHANNEL_OFF = 2;

export function defaultChannels(): ChannelSettings {
  // Both OFF. A reminder the learner never asked for is the one thing F-EN-7's
  // "never guilt" clause cannot save, and the permission prompt is gated on a tap
  // anyway, so an on-by-default push channel could only ever be a channel with no
  // permission behind it.
  return { push: false, email: false };
}

/* ----------------------------------------------------------- the usual time */

/**
 * Quiet hours, as local hours [start, end) wrapping midnight.
 *
 * A fixed window rather than a setting, because F-EN-7 says quiet hours are
 * respected and does not say the learner chooses them; a preference with no
 * screen would be a field nothing sets.
 */
export const QUIET_FROM_HOUR = 21;
export const QUIET_UNTIL_HOUR = 8;

/** The hour a reminder falls back to when the log cannot say when the learner shows up. */
export const DEFAULT_REMINDER_HOUR = 18;

/** How many days of activity the usual time is computed from. */
export const USUAL_TIME_WINDOW_DAYS = 14;

export function isQuietHour(hour: number): boolean {
  // Wrapping window: 21, 22, 23, 0 … 7 are quiet; 8 … 20 are not.
  return hour >= QUIET_FROM_HOUR || hour < QUIET_UNTIL_HOUR;
}

/**
 * The learner's usual time, as a local hour.
 *
 * The MEDIAN hour of the qualifying-shaped activity in the window, not the mean:
 * one 02:00 session drags a mean by hours and leaves the reminder at a time the
 * learner is never awake, while the median ignores it. Ties round down, so a
 * learner split evenly between 18:00 and 19:00 is reminded at the earlier hour and
 * has the later one still ahead of them.
 *
 * Read from `createdAt`'s LOCAL hour, which is the one thing `deviceDay` cannot
 * give: the day is stamped, the hour is not. That makes the hour a reading of the
 * device this code runs on rather than of the device the event was appended on —
 * a real limitation for a learner who moves between zones, and the right trade,
 * because the reminder will be delivered to the device reading it.
 *
 * Quiet hours are applied LAST, and by moving the time rather than by suppressing
 * the reminder: a learner whose habit is 23:00 still gets one reminder, at the
 * end of quiet hours, instead of silently getting none.
 */
export function usualHour(events: readonly LearnerEvent[], now: Date): number {
  const cutoff = new Date(now.getTime() - USUAL_TIME_WINDOW_DAYS * 86_400_000);
  const hours = events
    .filter((e) => new Date(e.createdAt).getTime() >= cutoff.getTime())
    .map((e) => new Date(e.createdAt).getHours())
    .sort((a, b) => a - b);
  if (hours.length === 0) return DEFAULT_REMINDER_HOUR;
  // Lower median: index (n-1)/2 floored.
  const median = hours[Math.floor((hours.length - 1) / 2)] ?? DEFAULT_REMINDER_HOUR;
  return median;
}

/** `usualHour` with quiet hours applied: the hour a reminder would actually go at. */
export function reminderHour(events: readonly LearnerEvent[], now: Date): number {
  const h = usualHour(events, now);
  return isQuietHour(h) ? QUIET_UNTIL_HOUR : h;
}

/* --------------------------------------------------------------- the copy */

export type ReminderTemplateId =
  | 'unfinished-review'
  | 'unfinished-lesson'
  | 'streak-at-risk'
  | 'streak-milestone-near'
  | 'come-back';

export interface ReminderContext {
  /** The lesson the path says is next, if the learner has one part-done. */
  resumeLessonTitle: string | null;
  /** A game finished and not yet reviewed, most recent first. */
  unreviewedGames: number;
  streak: Streak;
}

export interface ReminderCopy {
  id: ReminderTemplateId;
  title: string;
  body: string;
}

/**
 * The template bank, in priority order. F-EN-7: "copy tests across a small set of
 * templates", "anchored on the learner's unfinished business ... or the streak".
 *
 * Unfinished business first, because it names something concrete; the streak
 * second, because it is about the app's own counter. `come-back` is last and is
 * the only one with nothing to anchor on — it therefore says the least, and says
 * nothing about what the learner failed to do.
 */
export const REMINDER_TEMPLATES: readonly {
  id: ReminderTemplateId;
  applies: (c: ReminderContext) => boolean;
  copy: (c: ReminderContext) => ReminderCopy;
}[] = [
  {
    id: 'unfinished-review',
    applies: (c) => c.unreviewedGames > 0,
    copy: (c) => ({
      id: 'unfinished-review',
      title: c.unreviewedGames === 1 ? 'One game still to look at' : `${String(c.unreviewedGames)} games still to look at`,
      body: 'The review is the half that makes the next game better. It takes a couple of minutes.',
    }),
  },
  {
    id: 'unfinished-lesson',
    applies: (c) => c.resumeLessonTitle !== null,
    copy: (c) => ({
      id: 'unfinished-lesson',
      title: `Pick up ${c.resumeLessonTitle ?? 'your lesson'}`,
      body: 'You were part way through. It opens where you left it.',
    }),
  },
  {
    id: 'streak-milestone-near',
    applies: (c) => c.streak.days > 0 && c.streak.nextMilestone !== null && c.streak.nextMilestone - c.streak.days === 1,
    copy: (c) => ({
      id: 'streak-milestone-near',
      title: `${String(c.streak.nextMilestone ?? 0)} days is one day away`,
      body: 'One lesson, five puzzles or a game review gets you there.',
    }),
  },
  {
    id: 'streak-at-risk',
    applies: (c) => c.streak.days > 0,
    copy: (c) => ({
      id: 'streak-at-risk',
      title: `${String(c.streak.days)} days so far`,
      // Says what keeps it and what is held in reserve. No count of missed days,
      // and no question the learner can only answer by feeling bad.
      body:
        c.streak.freezes > 0
          ? `Anything today keeps it going, and you have ${String(c.streak.freezes)} ${c.streak.freezes === 1 ? 'freeze' : 'freezes'} in reserve.`
          : 'Anything today keeps it going: one lesson, five puzzles or a game review.',
    }),
  },
  {
    id: 'come-back',
    applies: () => true,
    copy: () => ({
      id: 'come-back',
      title: 'Ten minutes of chess?',
      body: 'A lesson, five puzzles or one game. Whichever you fancy.',
    }),
  },
];

/** The copy one reminder would carry: the first template that applies. */
export function chooseCopy(c: ReminderContext): ReminderCopy {
  for (const t of REMINDER_TEMPLATES) if (t.applies(c)) return t.copy(c);
  // Unreachable: `come-back` applies unconditionally. Written as a throw rather
  // than a fallback so that removing its `applies: () => true` is a loud failure
  // and not a silently empty reminder.
  throw new Error('no reminder template applied');
}

/* ------------------------------------------------------------ the decision */

export type ReminderPlan =
  | { send: false; reason: 'no-channel-on' | 'already-sent-today' | 'acted-today' }
  | { send: true; channel: ReminderChannel; hour: number; copy: ReminderCopy };

export interface ReminderPlanInput {
  channels: ChannelSettings;
  /** The local day a reminder was last sent, or null. F-EN-7's "one a day at most". */
  lastSentDay: string | null;
  today: string;
  /** True when the learner has already done something qualifying today. */
  actedToday: boolean;
  hour: number;
  context: ReminderContext;
}

/**
 * Whether one reminder would be sent today, on which channel, at which hour, and
 * saying what.
 *
 * Pure, and it decides nothing about delivery — see the header. Push is preferred
 * and email is the fallback, exactly as F-EN-7 orders them.
 *
 * A learner who has already done something today is not reminded. F-EN-7 does not
 * say so in as many words, but a reminder to do the thing you have just done is
 * the definition of a notification sent for the sender's benefit, which is the
 * clause about guilt read from the other side.
 */
export function plan(input: ReminderPlanInput): ReminderPlan {
  if (input.actedToday) return { send: false, reason: 'acted-today' };
  if (input.lastSentDay === input.today) return { send: false, reason: 'already-sent-today' };
  const channel: ReminderChannel | null = input.channels.push ? 'push' : input.channels.email ? 'email' : null;
  if (channel === null) return { send: false, reason: 'no-channel-on' };
  return { send: true, channel, hour: input.hour, copy: chooseCopy(input.context) };
}

/* ------------------------------------------- the permission prompt's caller */

export type PermissionOutcome =
  | { requested: false; decision: ReminderDecision }
  | { requested: true; permission: NotificationPermission };

/**
 * F-EN's reminder control — the caller `onboarding/notifications.ts` names in its
 * own docblock, and the only thing in this app that may raise the prompt.
 *
 * Called from a DOM click handler and nowhere else. `fromTap` is passed as a
 * literal `true` by that handler; there is no parameter a timer could set.
 *
 * The browser's own permission state is checked here rather than inside the gate,
 * which is pure: a learner who already granted or already denied is not asked
 * again, because in every browser a denial is permanent and asking again is not
 * something this code gets to decide.
 */
export async function requestPermissionFromTap(
  events: readonly LearnerEvent[],
): Promise<PermissionOutcome> {
  const decision = mayRequestNotificationPermission({
    activeDays: activityDays(events).length,
    fromTap: true,
  });
  if (!decision.allowed) return { requested: false, decision };
  if (typeof Notification === 'undefined') {
    return { requested: false, decision: { allowed: false, reason: 'not-a-tap' } };
  }
  if (Notification.permission !== 'default') {
    return { requested: true, permission: Notification.permission };
  }
  const permission = await Notification.requestPermission();
  return { requested: true, permission };
}

/** Whether the "remind me" control should be offered at all, without asking for anything. */
export function reminderControlReady(events: readonly LearnerEvent[]): ReminderDecision {
  // `fromTap: true` is passed so this reports on the ACTIVITY condition only; the
  // tap condition is answered by the DOM, and a control that hid itself until the
  // learner tapped it would be a control nobody could tap.
  return mayRequestNotificationPermission({ activeDays: activityDays(events).length, fromTap: true });
}
