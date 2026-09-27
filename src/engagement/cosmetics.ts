import { BOARD_TOKENS, FALLBACK_PALETTE, contrastRatio, type BoardToken } from '@/board/boardColors';
import type { Achievement, AchievementId } from './achievements';

/**
 * F-EN-6, verbatim:
 *
 * > "Cosmetics. Board colours, piece sets and coach reactions unlocked by
 * > achievements and quests. Never anything that affects learning."
 *
 * ── HOW "NEVER AFFECTS LEARNING" IS ENFORCED RATHER THAN PROMISED ────────────
 *
 * A cosmetic here is a set of overrides for a fixed, enumerated list of CSS
 * custom properties — `COSMETIC_TOKENS` — and nothing else. It cannot reach
 * difficulty, hints, the engine, the bot's strength, the puzzle ladder or the
 * path, because it has no way to express any of them: the type is
 * `Partial<Record<CosmeticToken, string>>` and `CosmeticToken` is four board
 * colours. `cosmetics.test.ts` asserts that the token list contains nothing
 * outside that set and that every shipped theme's keys are inside it.
 *
 * That is the structural half. The second half is that a board a learner cannot
 * read IS a change to learning, so a theme that breaks DESIGN-SYSTEM.md §3.1's
 * piece rule is not a cosmetic either — it is a handicap. `pieceRuleHolds`
 * measures every piece-on-square combination the way §3.1 states it, and no
 * theme ships without passing it.
 *
 * ── WHAT "PIECE SETS" CAN MEAN IN THIS BUILD, STATED PLAINLY ─────────────────
 *
 * F-EN-6 lists piece SETS. The board draws pieces from `react-chessboard`'s own
 * SVG sprites, recoloured by `--piece-light` / `--piece-dark` (`board/Board.tsx`);
 * there is no second sprite set in the repository and adding one is an asset
 * question, not a code one. So a "piece set" here is a piece COLOUR pair, and it
 * is bounded by the same piece rule. The glyph shapes are unchanged, and that is
 * a limitation rather than a design.
 *
 * Coach reactions are also listed by F-EN-6 and are NOT built: there is no
 * reaction bank to pick from (PRD 8.10 owns the cast). No entry claims one.
 *
 * ── HOW THEY ARE UNLOCKED ────────────────────────────────────────────────────
 *
 * "Unlocked by achievements and quests", so an entry names either an achievement
 * or a number of quest credits (`quests.ts`). One theme is unlocked from the
 * start, because a picker with nothing in it is not a reward.
 */

/**
 * The ONLY properties a cosmetic may set. Every one is a board colour from
 * `board/boardColors.ts`, which is the module the board actually reads.
 *
 * `--mark-good` and `--mark-review` are deliberately absent: they carry the
 * board's meaning (a good square, a square to review), so letting a theme move
 * them would be letting a cosmetic change what the learner is told.
 */
export const COSMETIC_TOKENS = ['--board-light', '--board-dark', '--piece-light', '--piece-dark'] as const;

export type CosmeticToken = (typeof COSMETIC_TOKENS)[number];

export type CosmeticKind = 'board' | 'pieces';

export interface CosmeticTheme {
  id: string;
  name: string;
  kind: CosmeticKind;
  /** What must be true to hold it. `null` means it is available from the start. */
  unlock: { achievement: AchievementId } | { questCredits: number } | null;
  overrides: Partial<Record<CosmeticToken, string>>;
}

/**
 * The shipped catalogue.
 *
 * The default board and pieces are the palette in `DESIGN-SYSTEM.md` §3.1, and
 * they are listed as entries with no overrides so that "the one you started with"
 * is a choice in the picker rather than the absence of a choice.
 */
export const COSMETICS: readonly CosmeticTheme[] = [
  {
    id: 'board-stone',
    name: 'Stone',
    kind: 'board',
    unlock: null,
    overrides: {},
  },
  {
    id: 'board-slate',
    name: 'Slate',
    kind: 'board',
    unlock: { achievement: 'first-checkpoint' },
    // Square-to-square 2.74:1, beside the shipping board's own 2.71:1, and every
    // piece-on-square combination clears 3:1. Both are measured by the test, in
    // every board-and-pieces combination rather than against the default alone.
    overrides: { '--board-light': '#DDE3E6', '--board-dark': '#7C8A93' },
  },
  {
    id: 'board-walnut',
    name: 'Walnut',
    kind: 'board',
    unlock: { questCredits: 8 },
    overrides: { '--board-light': '#E8DCC8', '--board-dark': '#8C6B4A' },
  },
  {
    id: 'board-moss',
    name: 'Moss',
    kind: 'board',
    unlock: { achievement: 'full-section' },
    overrides: { '--board-light': '#E2E6D8', '--board-dark': '#7A8869' },
  },
  {
    id: 'pieces-classic',
    name: 'Classic',
    kind: 'pieces',
    unlock: null,
    overrides: {},
  },
  {
    id: 'pieces-ivory',
    name: 'Ivory and ebony',
    kind: 'pieces',
    unlock: { achievement: 'clean-game' },
    overrides: { '--piece-light': '#F6F1E3', '--piece-dark': '#14100C' },
  },
  {
    id: 'pieces-pewter',
    name: 'Pewter',
    kind: 'pieces',
    unlock: { questCredits: 20 },
    overrides: { '--piece-light': '#FAFAF8', '--piece-dark': '#1F2124' },
  },
];

export interface CosmeticsInput {
  achievements: readonly Achievement[];
  questCredits: number;
}

export function isUnlocked(theme: CosmeticTheme, input: CosmeticsInput): boolean {
  if (theme.unlock === null) return true;
  if ('questCredits' in theme.unlock) return input.questCredits >= theme.unlock.questCredits;
  // Hoisted out of the closure: narrowing does not survive into the callback.
  const needed = theme.unlock.achievement;
  return input.achievements.some((x) => x.id === needed && x.unlocked);
}

export function unlockedCosmetics(input: CosmeticsInput): CosmeticTheme[] {
  return COSMETICS.filter((c) => isUnlocked(c, input));
}

/* -------------------------------------------------- the piece rule, measured */

/**
 * DESIGN-SYSTEM.md §3.1's piece rule, stated so an implementer can test it:
 *
 * > "Every piece is drawn with a fill and a 1.5px outline in the opposing piece
 * > colour. For every piece-on-square combination, max(fill contrast, outline
 * > contrast) must be at least 3:1."
 */
export const PIECE_RULE_MIN = 3;

/**
 * The palette a set of chosen themes produces on top of the shipping one.
 *
 * A LIST, not one theme: a learner picks a board AND a piece set, so the rule
 * below has to hold for the combination. Checking each theme against the default
 * palette would pass a pair that fails together, and the pair is what renders.
 */
export function paletteWith(themes: readonly CosmeticTheme[]): Record<BoardToken, string> {
  const out = { ...FALLBACK_PALETTE };
  for (const theme of themes) {
    for (const [token, value] of Object.entries(theme.overrides)) {
      // The cast is safe by construction: `overrides` is keyed by `CosmeticToken`,
      // every one of which is in `BOARD_TOKENS`, and a test asserts that.
      out[token as BoardToken] = value;
    }
  }
  return out;
}

export interface PieceRuleResult {
  ok: boolean;
  /**
   * Every combination, so a failure names itself rather than reporting a boolean.
   *
   * Four rows, not the eight §3.1 tabulates: that table covers two appearances and
   * this app ships one (`board/boardColors.ts`). Two piece colours on two squares
   * is the whole space.
   */
  measurements: { piece: 'light' | 'dark'; square: 'light' | 'dark'; fill: number; outline: number; best: number }[];
  /** Square-to-square contrast, reported rather than gated — see §3.1. */
  squareToSquare: number;
}

export function pieceRule(themes: readonly CosmeticTheme[]): PieceRuleResult {
  const p = paletteWith(themes);
  const squares = { light: p['--board-light'], dark: p['--board-dark'] };
  const pieces = { light: p['--piece-light'], dark: p['--piece-dark'] };
  const measurements = (['light', 'dark'] as const).flatMap((piece) =>
    (['light', 'dark'] as const).map((square) => {
      const fill = contrastRatio(pieces[piece], squares[square]);
      // The outline is the OPPOSING piece colour, per §3.1.
      const outline = contrastRatio(pieces[piece === 'light' ? 'dark' : 'light'], squares[square]);
      return { piece, square, fill, outline, best: Math.max(fill, outline) };
    }),
  );
  return {
    ok: measurements.every((m) => m.best >= PIECE_RULE_MIN),
    measurements,
    squareToSquare: contrastRatio(squares.light, squares.dark),
  };
}

/** True when every one of §3.1's eight combinations clears 3:1. */
export function pieceRuleHolds(themes: readonly CosmeticTheme[]): boolean {
  return pieceRule(themes).ok;
}

/**
 * The custom properties to set on the document root for a chosen board and piece
 * set. The board reads these through `resolveBoardPalette()`, so no component
 * needs to know a cosmetic exists.
 */
export function overridesFor(chosen: readonly CosmeticTheme[]): Partial<Record<CosmeticToken, string>> {
  return Object.assign({}, ...chosen.map((c) => c.overrides)) as Partial<Record<CosmeticToken, string>>;
}

/** Every cosmetic token is one the board actually reads. Used by the test and by `paletteWith`. */
export function cosmeticTokensAreBoardTokens(): boolean {
  return COSMETIC_TOKENS.every((t) => (BOARD_TOKENS as readonly string[]).includes(t));
}
