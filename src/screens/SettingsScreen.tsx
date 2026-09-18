import { useState } from 'react';
import { btn } from '@/app/Button';
import { Link } from 'react-router';
import { useSettings } from '@/app/settings';
import { useProgress } from '@/data';
import { clearDeviceData } from '@/app/clearDeviceData';
import { useAuth, signIn, signOut } from '@/sync/supabaseClient';

function Toggle({
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
    <label className="flex min-h-11 items-start justify-between gap-4 py-3">
      <span>
        <span className="t-heading block">{label}</span>
        {/* The hint is the only visible statement of what the toggle does, so it
            takes `label` (15px) rather than `caption`, which §3.2 reserves for
            metadata that is never the sole carrier of its meaning. */}
        <span className="t-label block text-content-dim">{hint}</span>
      </span>
      {/* 28px is the platform floor for a control that is not the whole row
          (accessibility.md > Controls); the label around it is the 44px target. */}
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

function AccountSection() {
  const { session, syncState, enabled } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!enabled) {
    return <p className="t-body text-content-dim">Accounts are not configured in this build.</p>;
  }

  if (!session) {
    return (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          signIn(email).then(
            () => {
              setSent(true);
            },
            (err: unknown) => {
              setError(err instanceof Error ? err.message : 'Could not send the link.');
            },
          );
        }}
      >
        <label className="block">
          <span className="t-heading block">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
            className="t-body n-inset-soft mt-1 min-h-11 w-full rounded-control border border-edge-strong bg-surface-raised px-3 py-2"
            placeholder="you@example.com"
          />
        </label>
        <button type="submit" className={btn.primary}>
          Send me a sign-in link
        </button>
        {sent && (
          <p role="status" className="t-label text-content-dim">
            Check your email for the link; your progress on this device will be kept and merged.
          </p>
        )}
        {error && (
          <p role="alert" className="t-label text-danger">
            {error}
          </p>
        )}
      </form>
    );
  }

  const status =
    syncState === 'syncing' ? 'Syncing…' : syncState === 'error' ? 'Not synced, will retry when online' : 'Synced';
  return (
    <div className="space-y-3">
      <p className="t-heading">{session.user.email}</p>
      <p role="status" className="t-label text-content-dim">
        {status}
      </p>
      <button
        type="button"
        className={btn.secondary}
        onClick={() => {
          void signOut();
        }}
      >
        Sign out
      </button>
      <p className="t-label text-content-dim">
        Signing out leaves this device&rsquo;s progress in place. Use &ldquo;Clear this device&rsquo;s data&rdquo; below
        to remove it.
      </p>
    </div>
  );
}

export function SettingsScreen() {
  const textEntry = useSettings((s) => s.textEntry);
  const setTextEntry = useSettings((s) => s.setTextEntry);
  const coachMuted = useSettings((s) => s.coachMuted);
  const setCoachMuted = useSettings((s) => s.setCoachMuted);
  const append = useProgress((s) => s.append);

  return (
    <section className="space-y-8 p-4 pb-24">
      <h1 className="t-display">Settings</h1>

      {/* D3: a decorative divider. It separates two rows that their own labels and
          spacing already separate, so it carries no meaning on its own and takes
          `--edge`, which §3.1 gives no contrast duty. It is not a boundary that
          is the sole separator of a control, which is the job `--edge-strong`
          exists for. */}
      <div className="divide-y divide-edge">
        <Toggle
          label="Text move entry"
          hint="Type moves instead of dragging pieces."
          checked={textEntry}
          onChange={(v) => {
            setTextEntry(v);
            void append({ type: 'settings_changed', key: 'textEntry', value: v });
          }}
        />
        <Toggle
          label="Mute the coach"
          hint="Hide the coach's spoken hints and praise."
          checked={coachMuted}
          onChange={(v) => {
            setCoachMuted(v);
            void append({ type: 'settings_changed', key: 'coachMuted', value: v });
          }}
        />
      </div>

      <div className="space-y-3">
        <h2 className="t-title">Account</h2>
        <AccountSection />
      </div>

      <div className="space-y-3">
        <h2 className="t-title">Your data</h2>
        <button
          type="button"
          className={btn.danger}
          onClick={() => {
            if (!window.confirm('Clear every lesson, game and setting stored on this device? This cannot be undone.'))
              return;
            void clearDeviceData().then(() => {
              window.location.reload();
            });
          }}
        >
          Clear this device&rsquo;s data
        </button>
        <p className="t-label text-content-dim">
          This removes everything ChessApp has stored in this browser. Deleting an account and the progress held on the
          server arrives in a later release.
        </p>
      </div>

      <p>
        <Link className="tap t-label inline-flex items-center underline" to="/licences">
          Licences
        </Link>
      </p>
    </section>
  );
}
