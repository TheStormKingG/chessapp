import { useCallback, useEffect, useRef, useState } from 'react';
import { btn } from '@/app/Button';
import { useProgress } from '@/data';
import { reportError } from '@/analytics';
import { FOREGROUND_COUNT, runBackgroundAnalysis, runForegroundAnalysis } from './analysisQueue';
import { makeImportedGameAnalyser } from './analyseImported';
import { failureMessage, skipMessage } from './messages';
import { nextBatchLimit, FIRST_IMPORT_SIZE } from './scope';
import { runImport, type ImportOutcome } from './runImport';
import { useImportSettings, knownUsernames } from './settings';
import { countImported } from './storage';
import type { Color } from '@/rules';
import type { ImportSource } from './types';

/**
 * F-IM-1's import screen, and F-IM-3's progress bar.
 *
 * The visual idiom is the house one and nothing here invents a pattern: cards are
 * `n-panel n-lit n-edge rounded-card bg-panel`, the progress bar is the
 * `n-inset-soft` track over `bg-track` that ReviewScreen and EngineDownload
 * already use, buttons come from `@/app/Button`, and the switches are the same
 * bare-checkbox-inside-a-label row SettingsScreen uses. The one element with no
 * precedent in src/ is a `<textarea>` — there was none — so it is styled with the
 * existing text-input classes rather than a new treatment.
 */

type Tab = 'paste' | 'account';

type Phase =
  | { kind: 'idle' }
  | { kind: 'fetching' }
  | { kind: 'analysing'; game: number; of: number; positions: number; ofPositions: number }
  | { kind: 'done'; outcome: ImportOutcome }
  | { kind: 'failed'; text: string; retryable: boolean };

export function ImportScreen({ onFinished }: { onFinished?: (added: number) => void }) {
  const [tab, setTab] = useState<Tab>('paste');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [pgnText, setPgnText] = useState('');
  const [pasteColor, setPasteColor] = useState<Color>('w');
  const [source, setSource] = useState<Exclude<ImportSource, 'pgn'>>('chess.com');
  const [username, setUsername] = useState('');
  const live = useRef(true);

  /*
   * F-IM-3's background pass outlives any one render, so leaving the screen has to
   * stop it. `live` is a ref rather than state because the queue reads it between
   * games through `shouldContinue`, and a state read would be a stale closure over
   * whatever the value was when the run started.
   *
   * Set to true on mount as well as false on cleanup: the development build
   * mounts, unmounts and remounts deliberately, and a ref that is only ever set
   * false leaves the second mount unable to analyse anything at all.
   */
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const append = useProgress((s) => s.append);
  const includeBullet = useImportSettings((s) => s.includeBullet);
  const setIncludeBullet = useImportSettings((s) => s.setIncludeBullet);
  const keepCurrent = useImportSettings((s) => s.keepCurrent);
  const setKeepCurrent = useImportSettings((s) => s.setKeepCurrent);
  const addAccount = useImportSettings((s) => s.addAccount);
  const accounts = useImportSettings((s) => s.accounts);

  /**
   * Runs the import, then F-IM-3's two analysis passes.
   *
   * The foreground pass is awaited so the learner watches it finish; the
   * background pass is deliberately NOT awaited, because F-IM-3 says the rest
   * happen "in the background while the app is open". It is stopped by `live`,
   * which the unmount flips.
   */
  const start = useCallback(
    async (limit: number) => {
      setPhase({ kind: 'fetching' });
      let outcome: ImportOutcome;
      try {
        outcome =
          tab === 'paste'
            ? await runImport(
                {
                  kind: 'pgn',
                  text: pgnText,
                  learner: pasteColor,
                  usernames: knownUsernames({ accounts }),
                },
                { fetch: (url, init) => fetch(url, init) },
              )
            : await runImport(
                { kind: 'account', source, username, limit },
                { fetch: (url, init) => fetch(url, init) },
              );
      } catch (e) {
        reportError(e, { where: 'import:run' });
        setPhase({ kind: 'failed', text: 'Something went wrong reading those games.', retryable: true });
        return;
      }
      if (!live.current) return;

      if (outcome.failure) {
        const m = failureMessage(outcome.failure);
        setPhase({ kind: 'failed', text: m.text, retryable: m.retryable });
        return;
      }

      void append({
        type: 'games_imported',
        source: tab === 'paste' ? 'pgn' : source,
        username: tab === 'paste' ? null : username.trim(),
        added: outcome.added,
        alreadyHeld: outcome.alreadyHeld,
        skipped: outcome.skipped.reduce((n, s) => n + s.count, 0),
      });
      if (tab === 'account' && outcome.added + outcome.alreadyHeld > 0) {
        // F-IM-4: "Once a username is entered, the app checks for new games each
        // time it opens." Remembering the username IS entering it. `confirmedOwn`
        // stays false — F-AC-5 wants a separate, deliberate confirmation before
        // these games touch the rating estimate.
        addAccount({ source, username: username.trim(), confirmedOwn: false });
      }

      const analyser = makeImportedGameAnalyser();
      setPhase({ kind: 'analysing', game: 0, of: Math.min(FOREGROUND_COUNT, outcome.added), positions: 0, ofPositions: 0 });
      await runForegroundAnalysis({
        analyser,
        shouldContinue: () => live.current,
        onPositions: (positions, ofPositions) => {
          setPhase((p) => (p.kind === 'analysing' ? { ...p, positions, ofPositions } : p));
        },
        onGameDone: (game, of) => {
          setPhase((p) => (p.kind === 'analysing' ? { ...p, game, of } : p));
        },
      });
      if (!live.current) return;
      setPhase({ kind: 'done', outcome });
      onFinished?.(outcome.added);

      // The rest, unawaited, while the app is open. F-IM-3.
      void runBackgroundAnalysis({ analyser, shouldContinue: () => live.current }).catch((e: unknown) => {
        reportError(e, { where: 'import:background' });
      });
    },
    [tab, pgnText, pasteColor, source, username, accounts, append, addAccount, onFinished],
  );

  const busy = phase.kind === 'fetching' || phase.kind === 'analysing';

  return (
    <section className="space-y-8 p-4 pb-24">
      <div>
        <h1 className="t-display">Import your games</h1>
        <p className="t-body mt-2 text-content-dim">
          Hand us the games you have already played and we will tell you what you do well and what keeps costing you.
          We never ask for your password for either site.
        </p>
      </div>

      <div className="flex gap-2" role="tablist" aria-label="Where your games come from">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'paste'}
          className={tab === 'paste' ? btn.primary : btn.secondary}
          onClick={() => {
            setTab('paste');
            setPhase({ kind: 'idle' });
          }}
        >
          Paste a PGN
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'account'}
          className={tab === 'account' ? btn.primary : btn.secondary}
          onClick={() => {
            setTab('account');
            setPhase({ kind: 'idle' });
          }}
        >
          From a username
        </button>
      </div>

      {tab === 'paste' ? (
        <div className="n-panel n-lit n-edge space-y-3 rounded-card bg-panel p-4">
          <label className="block" htmlFor="pgn-text">
            <span className="t-heading block">Your games, in PGN</span>
            <span className="t-label block text-content-dim">
              Paste one game or a whole file. Nothing leaves your device on this route.
            </span>
          </label>
          <textarea
            id="pgn-text"
            rows={8}
            value={pgnText}
            onChange={(e) => {
              setPgnText(e.target.value);
            }}
            placeholder={'[White "you"]\n[Black "them"]\n\n1. e4 e5 2. Nf3 ...'}
            className="t-body n-inset-soft n-lit-sunken mt-1 w-full rounded-control border border-edge-strong bg-surface-raised px-3 py-2 text-content placeholder:text-content-dim focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          <label className="block" htmlFor="pgn-file">
            <span className="t-label block text-content-dim">…or choose a .pgn file</span>
            <input
              id="pgn-file"
              type="file"
              accept=".pgn,application/x-chess-pgn,text/plain"
              className="t-label tap mt-1 block w-full"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void file.text().then((t) => {
                  setPgnText(t);
                });
              }}
            />
          </label>
          <fieldset className="pt-1">
            <legend className="t-label text-content-dim">
              Which side were you? Used only for games we cannot match to a username.
            </legend>
            <div className="mt-2 flex gap-2">
              {(['w', 'b'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={pasteColor === c}
                  className={pasteColor === c ? btn.primary : btn.secondary}
                  onClick={() => {
                    setPasteColor(c);
                  }}
                >
                  {c === 'w' ? 'White' : 'Black'}
                </button>
              ))}
            </div>
          </fieldset>
          <button
            type="button"
            className={btn.primary}
            disabled={busy || pgnText.trim() === ''}
            onClick={() => {
              void start(FIRST_IMPORT_SIZE);
            }}
          >
            Import these games
          </button>
        </div>
      ) : (
        <div className="n-panel n-lit n-edge space-y-3 rounded-card bg-panel p-4">
          <fieldset>
            <legend className="t-heading">Where do you play?</legend>
            <div className="mt-2 flex gap-2">
              {(['chess.com', 'lichess'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={source === s}
                  className={source === s ? btn.primary : btn.secondary}
                  onClick={() => {
                    setSource(s);
                  }}
                >
                  {s === 'chess.com' ? 'chess.com' : 'Lichess'}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block" htmlFor="import-username">
            <span className="t-heading block">Your username there</span>
            <span className="t-label block text-content-dim">Public games only. We never ask for a password.</span>
            <input
              id="import-username"
              type="text"
              autoComplete="off"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
              }}
              className="t-body n-inset-soft n-lit-sunken mt-1 min-h-11 w-full rounded-control border border-edge-strong bg-surface-raised px-3 py-2 text-content placeholder:text-content-dim focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </label>
          <button
            type="button"
            className={btn.primary}
            disabled={busy || username.trim() === ''}
            onClick={() => {
              void start(FIRST_IMPORT_SIZE);
            }}
          >
            Import my last {FIRST_IMPORT_SIZE} games
          </button>
        </div>
      )}

      {phase.kind === 'fetching' && (
        <p className="t-body text-content-dim" aria-live="polite">
          Reading your games…
        </p>
      )}

      {phase.kind === 'analysing' && <AnalysisProgress phase={phase} />}

      {phase.kind === 'failed' && (
        <div role="alert" className="n-panel n-lit n-edge rounded-card bg-panel p-4">
          <p className="t-body text-danger">{phase.text}</p>
          {phase.retryable && (
            <button
              type="button"
              className={`${btn.secondary} mt-3`}
              onClick={() => {
                void start(FIRST_IMPORT_SIZE);
              }}
            >
              Try again
            </button>
          )}
        </div>
      )}

      {phase.kind === 'done' && <Outcome outcome={phase.outcome} onMore={(n) => void start(n)} busy={busy} />}

      <div className="space-y-1">
        <h2 className="t-title">While importing</h2>
        <SwitchRow
          label="Include bullet games in my profile"
          hint="Bullet mistakes are usually the clock, not your chess, so they are left out by default."
          checked={includeBullet}
          onChange={(v) => {
            setIncludeBullet(v);
            void append({ type: 'settings_changed', key: 'importIncludeBullet', value: v });
          }}
        />
        <SwitchRow
          label="Keep my games up to date"
          hint="Check for new games when the app opens, at most once a day."
          checked={keepCurrent}
          onChange={(v) => {
            setKeepCurrent(v);
            void append({ type: 'settings_changed', key: 'importKeepCurrent', value: v });
          }}
        />
      </div>
    </section>
  );
}

/**
 * F-IM-3's "visible progress bar".
 *
 * Two numbers, because there are two: which game of the ten, and how far through
 * that game's positions. One alone is misleading — a bar that only counts games
 * sits still for thirty seconds at a time, and one that only counts positions
 * restarts ten times without saying why.
 */
function AnalysisProgress({ phase }: { phase: Extract<Phase, { kind: 'analysing' }> }) {
  const of = Math.max(1, phase.of);
  const within = phase.ofPositions > 0 ? phase.positions / phase.ofPositions : 0;
  const fraction = Math.min(1, (phase.game + within) / of);
  const percent = Math.round(fraction * 100);
  return (
    <div className="n-panel n-lit n-edge rounded-card bg-panel p-4">
      <p className="t-heading">Analysing your games</p>
      <p className="t-label text-content-dim">
        Game {String(Math.min(phase.game + 1, of))} of {String(of)}
        {phase.ofPositions > 0 ? `, position ${String(phase.positions)} of ${String(phase.ofPositions)}` : ''}
      </p>
      <div
        role="progressbar"
        aria-label="Analysis progress"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="n-inset-soft mt-4 h-2 w-full overflow-hidden rounded-full bg-track"
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${String(percent)}%` }} />
      </div>
      <p className="t-caption mt-2 text-content-dim">
        The rest are analysed in the background while the app is open, and carry on next time.
      </p>
    </div>
  );
}

function Outcome({
  outcome,
  onMore,
  busy,
}: {
  outcome: ImportOutcome;
  onMore: (limit: number) => void;
  busy: boolean;
}) {
  const [more, setMore] = useState<number | null>(null);
  /*
   * The next batch is computed from what is STORED, not from this import's count,
   * because a learner may have imported from two sources — and `nextBatchLimit`
   * returns null at the 500 ceiling, which is how the button disappears.
   *
   * In an effect, not during render: reading Dexie and calling setState in the
   * render body is a second render before the first has committed, and it re-ran
   * on every parent update.
   */
  useEffect(() => {
    let live = true;
    void countImported().then((held) => {
      if (live) setMore(nextBatchLimit(held));
    });
    return () => {
      live = false;
    };
  }, [outcome]);

  return (
    <div className="n-panel n-lit n-edge space-y-2 rounded-card bg-panel p-4" aria-live="polite">
      {/*
        Three cases, not two. "We already had those games" is only true when we
        actually held them: an import in which every game was REFUSED also adds
        nothing, and telling that learner we already had their games is a plain
        falsehood that hides the reason lines directly beneath it. Caught by
        walking the paste path in the browser with a game that does not replay.
      */}
      <p className="t-heading">
        {outcome.added > 0
          ? `${String(outcome.added)} game${outcome.added === 1 ? '' : 's'} imported.`
          : outcome.alreadyHeld > 0
            ? 'Nothing new to add — we already had those games.'
            : 'No games were imported.'}
      </p>
      {outcome.alreadyHeld > 0 && (
        <p className="t-label text-content-dim">
          {String(outcome.alreadyHeld)} we already had, so they cost nothing to fetch again.
        </p>
      )}
      {outcome.skipped.map((s) => (
        <p key={s.reason} className="t-label text-content-dim">
          {skipMessage(s.reason, s.count)}
        </p>
      ))}
      {more !== null && (
        <button
          type="button"
          className={btn.secondary}
          disabled={busy}
          onClick={() => {
            onMore(more);
          }}
        >
          Import 50 more
        </button>
      )}
    </div>
  );
}

/** The same row SettingsScreen uses; see its comment for why the measure is capped. */
function SwitchRow({
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
