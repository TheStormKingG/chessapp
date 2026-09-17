import { useState } from 'react';
import { Link } from 'react-router';
import { useSettings } from '@/app/settings';
import { useProgress, db } from '@/data';
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
    <label className="flex items-start justify-between gap-4 py-3">
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-sm text-ink-muted">{hint}</span>
      </span>
      <input
        type="checkbox"
        className="mt-1 size-6 shrink-0"
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
    return <p className="text-ink-muted">Accounts are not configured in this build.</p>;
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
          <span className="block font-medium">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            placeholder="you@example.com"
          />
        </label>
        <button type="submit" className="tap rounded-lg bg-accent px-4 py-2 font-medium text-white">
          Send me a sign-in link
        </button>
        {sent && (
          <p role="status" className="text-sm text-ink-muted">
            Check your email for the link; your progress on this device will be kept and merged.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
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
      <p className="font-medium">{session.user.email}</p>
      <p role="status" className="text-sm text-ink-muted">
        {status}
      </p>
      <button
        type="button"
        className="tap rounded-lg border border-line px-4 py-2 font-medium"
        onClick={() => {
          void signOut();
        }}
      >
        Sign out
      </button>
      <p className="text-sm text-ink-muted">
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
      <h1 className="text-xl font-semibold">Settings</h1>

      <div className="divide-y divide-ink-muted/20">
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
        <h2 className="text-lg font-semibold">Account</h2>
        <AccountSection />
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Your data</h2>
        <button
          type="button"
          className="tap rounded-lg border border-danger/50 px-4 py-2 font-medium text-danger"
          onClick={() => {
            if (!window.confirm('Clear every lesson, game and setting stored on this device? This cannot be undone.'))
              return;
            void db.delete().then(() => {
              window.location.reload();
            });
          }}
        >
          Clear this device&rsquo;s data
        </button>
        <p className="text-sm text-ink-muted">
          This removes everything ChessApp has stored in this browser. Deleting an account and the progress held on the
          server arrives in a later release.
        </p>
      </div>

      <p className="text-sm">
        <Link className="underline" to="/licences">
          Licences
        </Link>
      </p>
    </section>
  );
}
