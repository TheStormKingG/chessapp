/** A named opponent character (PRD F-PL-1, F-CO-3). */
export interface Persona {
  id: string;
  name: string;
  /** Path to the avatar image. */
  avatar: string;
  /** How the rating is shown to the learner until the bots are calibrated, e.g. "about 600". */
  ratingBand: string;
  /** The uncalibrated numeric rating behind the band. Never shown raw in the UI. */
  rating: number;
  bio: string;
  /** Move-selection weights: the persona's playing style. */
  style: { capture: number; check: number; quiet: number; trade: number };
  /** Opening preference, in order, as UCI moves. */
  opening: { white: string[]; black: string[] };
  error: {
    base: number;
    complexity: number;
    openingFactor: number;
    endgameFactor: number;
    /** Error kinds typical of this band, as named by the tagger. */
    kinds: string[];
  };
}

export interface Complexity {
  captures: number;
  checks: number;
  phase: 'opening' | 'middlegame' | 'endgame';
}

/** How a candidate move reads at the board, used to apply the persona's style weights. */
export type MoveKind = 'capture' | 'check' | 'quiet' | 'trade';
