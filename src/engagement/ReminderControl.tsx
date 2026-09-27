import { useEffect, useState } from 'react';
import { btn } from '@/app/Button';
import { useSettings } from '@/app/settings';
import { db } from '@/data/db';
import type { LearnerEvent } from '@/data/events';
import {
  QUIET_FROM_HOUR,
  QUIET_UNTIL_HOUR,
  reminderControlReady,
  reminderHour,
  requestPermissionFromTap,
} from './reminders';

/**
 * F-EN-7's reminder control, in Settings.
 *
 * ── THE PERMISSION PROMPT IS RAISED FROM THIS ONE onClick AND NOWHERE ELSE ────
 *
 * `requestPermissionFromTap` asks `onboarding/notifications.ts`'s gate and touches
 * `Notification.requestPermission()` only when it allows. There is no effect, no
 * timer and no mount path into it: the button below is the only caller in the app,
 * and `fromTap` is a literal inside that function rather than a parameter this
 * component could get wrong. A denial is permanent in every browser, so the control
 * is not even OFFERED until the gate's two days of activity have passed — it says
 * so instead, which is a fact about the learner's own history and not a refusal.
 *
 * ── WHAT THE LEARNER IS TOLD, GIVEN NOTHING CAN SEND YET ─────────────────────
 *
 * The honest part. Push delivery needs a push service and a server to send from,
 * and email needs a sender; neither exists (`reminders.ts` states both in full).
 * So the switches record the learner's choice and the screen says plainly that
 * reminders are not being sent yet. The alternative — switches that look live and
 * silently do nothing — is the version a learner would only discover by missing a
 * reminder they were relying on.
 */
export function ReminderControl() {
  const push = useSettings((s) => s.remindPush);
  const setPush = useSettings((s) => s.setRemindPush);
  const email = useSettings((s) => s.remindEmail);
  const setEmail = useSettings((s) => s.setRemindEmail);

  const [events, setEvents] = useState<readonly LearnerEvent[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );

  useEffect(() => {
    let live = true;
    db.events
      .toArray()
      .then((e) => {
        if (live) setEvents(e);
      })
      .catch(() => {
        /* the control renders its "not yet" state, which is the safe one */
      });
    return () => {
      live = false;
    };
  }, []);

  const ready = reminderControlReady(events);
  const hour = reminderHour(events, new Date());

  return (
    <div className="space-y-3">
      {/* The two switches. One tap to reach Settings, one tap here: F-EN-7's
          "each channel off in two taps", with no sub-page in between. */}
      <div className="max-w-sm divide-y divide-edge">
        <Switch
          label="Remind me here"
          hint={`One reminder a day at most, around ${String(hour)}:00.`}
          checked={push}
          onChange={setPush}
        />
        <Switch
          label="Remind me by email"
          hint="The fallback when a browser reminder cannot be shown, and the weekly summary."
          checked={email}
          onChange={setEmail}
        />
      </div>

      <p className="t-label text-content-dim">
        Nothing is sent between {QUIET_FROM_HOUR}:00 and {QUIET_UNTIL_HOUR}:00.
      </p>

      {permission === 'unsupported' ? (
        <p className="t-label text-content-dim">This browser cannot show reminders.</p>
      ) : permission === 'granted' ? (
        <p className="t-label text-content-dim" role="status">
          This browser will allow reminders.
        </p>
      ) : permission === 'denied' ? (
        <p className="t-label text-content-dim" role="status">
          This browser is blocking reminders. That can only be changed in the browser&rsquo;s own site settings.
        </p>
      ) : !ready.allowed ? (
        <p className="t-label text-content-dim">
          {/* The gate's own reason, in the learner's terms. Nothing is asked. */}
          After a couple of days of practice you can allow reminders here.
        </p>
      ) : (
        <button
          type="button"
          className={btn.secondary}
          onClick={() => {
            // The ONLY call site of the permission prompt in this app.
            void requestPermissionFromTap(events).then((out) => {
              if (out.requested) setPermission(out.permission);
            });
          }}
        >
          Allow reminders in this browser
        </button>
      )}

      <p className="t-label text-content-dim">
        Reminders are not being delivered yet: sending them needs a push service and an email sender that this build
        does not have. Your choices here are saved for when it does.
      </p>
    </div>
  );
}

/**
 * The same row `screens/SettingsScreen.tsx` uses for its own switches — capped at
 * `max-w-sm` for the reason recorded there, and with the 28px control the platform
 * floor allows inside a 44px label.
 */
function Switch({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 max-w-sm items-start justify-between gap-4 py-3">
      <span>
        <span className="t-heading block">{label}</span>
        <span className="t-label block text-content-dim">{hint}</span>
      </span>
      <input
        type="checkbox"
        className="mt-1 size-7 shrink-0"
        checked={checked}
        onChange={(e) => {
          onChange(e.target.checked);
        }}
      />
    </label>
  );
}
