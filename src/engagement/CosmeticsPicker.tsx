import { useSettings } from '@/app/settings';
import { COSMETICS, isUnlocked, type CosmeticKind, type CosmeticTheme } from './cosmetics';
import { useEngagement } from './state';

/**
 * F-EN-6's picker, in Settings.
 *
 * ── THE IDIOM ────────────────────────────────────────────────────────────────
 *
 * A radio group, which is what "one of these" means, in the same row grammar as
 * Settings' own switches. NOT a row of coloured swatches: DESIGN-SYSTEM.md §3.3
 * rules out a pill or a disc for anything that receives the press, and a swatch
 * with no name carries its meaning in colour alone — which is the one thing this
 * app's own rules forbid everywhere else. Each option is named in words, with the
 * board's two colours shown beside the name as a small square sample that is
 * `aria-hidden` and decorative, exactly as the unit meter is.
 *
 * A locked option is DISABLED and says what earns it, rather than being hidden.
 * F-EN-6's cosmetics are "unlocked by achievements and quests", so seeing what is
 * there to earn is the point; hiding them would make the feature invisible until
 * it was already finished.
 */
export function CosmeticsPicker() {
  const engagement = useEngagement();
  const held = { achievements: engagement.achievements, questCredits: engagement.questCredits };

  const boardId = useSettings((s) => s.boardCosmetic);
  const setBoard = useSettings((s) => s.setBoardCosmetic);
  const piecesId = useSettings((s) => s.piecesCosmetic);
  const setPieces = useSettings((s) => s.setPiecesCosmetic);

  return (
    <div className="space-y-6">
      <Group
        kind="board"
        legend="Board"
        chosen={boardId}
        onChoose={setBoard}
        held={held}
        credits={engagement.questCredits}
      />
      <Group
        kind="pieces"
        legend="Pieces"
        chosen={piecesId}
        onChoose={setPieces}
        held={held}
        credits={engagement.questCredits}
      />
      <p className="t-label text-content-dim">
        Board colours and piece colours only. Nothing here changes a lesson, a puzzle, a hint or how the bot plays.
      </p>
    </div>
  );
}

function Group({
  kind,
  legend,
  chosen,
  onChoose,
  held,
  credits,
}: {
  kind: CosmeticKind;
  legend: string;
  chosen: string | null;
  onChoose: (id: string | null) => void;
  held: Parameters<typeof isUnlocked>[1];
  credits: number;
}) {
  const options = COSMETICS.filter((c) => c.kind === kind);
  const defaultId = options.find((c) => c.unlock === null)?.id ?? null;

  return (
    <fieldset>
      <legend className="t-caption uppercase tracking-wide text-content-dim">{legend}</legend>
      <div className="mt-2 max-w-sm divide-y divide-edge">
        {options.map((option) => {
          const unlocked = isUnlocked(option, held);
          // The default entry is what an unset preference means, so it is the one
          // shown as chosen when nothing has been chosen.
          const isChosen = chosen === null ? option.id === defaultId : chosen === option.id;
          return (
            <label
              key={option.id}
              className="flex min-h-11 items-center justify-between gap-4 py-3"
              data-testid={`cosmetic-${option.id}`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <Sample theme={option} />
                <span className="min-w-0">
                  <span className="t-label block">{option.name}</span>
                  {!unlocked && <span className="t-label block text-content-dim">{earns(option, credits)}</span>}
                </span>
              </span>
              <input
                type="radio"
                name={`cosmetic-${kind}`}
                className="size-7 shrink-0"
                checked={isChosen}
                disabled={!unlocked}
                onChange={() => {
                  onChoose(option.id === defaultId ? null : option.id);
                }}
              />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** What earns a locked option, in words. */
function earns(theme: CosmeticTheme, credits: number): string {
  if (theme.unlock === null) return '';
  if ('questCredits' in theme.unlock) {
    const left = theme.unlock.questCredits - credits;
    return `${String(theme.unlock.questCredits)} quest rewards (${String(Math.max(0, left))} to go)`;
  }
  return 'An achievement on the Progress tab';
}

/**
 * A 28px square showing the option's two colours. Decorative: the name beside it
 * says which option this is, so nothing is carried by the colours alone.
 *
 * 28px with an 8px radius, which is the ONE recorded exception in §3.3's shape cap
 * (0.273 x 28 = 7.6, capped at 9.33) — the same box and the same number as the
 * coach-mode checkbox, for the same measured reason.
 */
function Sample({ theme }: { theme: CosmeticTheme }) {
  const a = theme.overrides['--board-light'] ?? theme.overrides['--piece-light'] ?? 'var(--board-light)';
  const b = theme.overrides['--board-dark'] ?? theme.overrides['--piece-dark'] ?? 'var(--board-dark)';
  return (
    <span
      aria-hidden="true"
      className="block size-7 shrink-0 overflow-hidden border border-edge-strong"
      style={{ borderRadius: '8px', background: `linear-gradient(135deg, ${a} 0 50%, ${b} 50% 100%)` }}
    />
  );
}
