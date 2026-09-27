import { useEffect } from 'react';
import { useSettings } from '@/app/settings';
import { COSMETICS, isUnlocked, overridesFor, pieceRuleHolds, type CosmeticTheme } from './cosmetics';
import { useEngagement } from './state';

/**
 * F-EN-6's chosen cosmetics, applied to the document root.
 *
 * ── WHY THE ROOT AND NOT THE BOARD COMPONENT ─────────────────────────────────
 *
 * `board/boardColors.ts` already resolves every colour the board paints from a
 * custom property on `document.documentElement`, and it does so at render time
 * because `react-chessboard` puts some of them on SVG presentation attributes
 * where `var()` is not substituted. So setting four properties on the root is the
 * whole mechanism: no component learns that cosmetics exist, the audit helpers
 * keep reading the same attributes back, and a cosmetic can reach nothing the
 * board does not already read.
 *
 * ── TWO GUARDS, AND WHY NEITHER IS PARANOIA ──────────────────────────────────
 *
 * A stored id is a value from a previous version of the app, so it is checked
 * against the catalogue every time it is applied:
 *
 *   1. AN ID THAT NO LONGER EXISTS, or one the learner no longer holds, falls back
 *      to the default. A learner who cleared their event log still has the id in
 *      `localStorage`, and a board they cannot re-earn is not a board they should
 *      keep.
 *   2. A PAIR THAT FAILS THE PIECE RULE is not applied. `cosmetics.test.ts` checks
 *      every shipped combination, but this check is about the pair that ACTUALLY
 *      renders, including one assembled from a stored id and a catalogue that has
 *      since changed. An unreadable board is a change to learning, which is the
 *      one thing F-EN-6 forbids.
 */
export function useApplyCosmetics(): void {
  const boardId = useSettings((s) => s.boardCosmetic);
  const piecesId = useSettings((s) => s.piecesCosmetic);
  const engagement = useEngagement();

  useEffect(() => {
    const chosen = resolveCosmetics(
      { boardId, piecesId },
      { achievements: engagement.achievements, questCredits: engagement.questCredits },
    );
    const root = document.documentElement;
    const overrides = overridesFor(chosen);
    for (const theme of COSMETICS) {
      for (const token of Object.keys(theme.overrides)) root.style.removeProperty(token);
    }
    for (const [token, value] of Object.entries(overrides)) root.style.setProperty(token, value);
  }, [boardId, piecesId, engagement.achievements, engagement.questCredits]);
}

/**
 * The themes that will actually be applied, after both guards above.
 *
 * Exported and pure so the guards are testable without a DOM.
 */
export function resolveCosmetics(
  chosen: { boardId: string | null; piecesId: string | null },
  held: Parameters<typeof isUnlocked>[1],
): CosmeticTheme[] {
  const pick = (id: string | null, kind: CosmeticTheme['kind']): CosmeticTheme | null => {
    if (id === null) return null;
    const theme = COSMETICS.find((c) => c.id === id && c.kind === kind);
    if (theme === undefined || !isUnlocked(theme, held)) return null;
    return theme;
  };
  const candidate = [pick(chosen.boardId, 'board'), pick(chosen.piecesId, 'pieces')].filter(
    (c): c is CosmeticTheme => c !== null,
  );
  // Guard 2: the pair, not each half. See the header.
  return pieceRuleHolds(candidate) ? candidate : [];
}
