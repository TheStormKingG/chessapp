import templates from '@content/coach/templates.json';
import type { PieceType } from '@/rules';

export type CoachEvent = keyof typeof templates.templates;
export type CoachFacts = Record<string, string | number | undefined>;

const NAMES: Record<PieceType, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

export class CoachService {
  muted = false;
  constructor(private readonly rng: () => number = Math.random) {}

  static pieceName(t: PieceType): string { return NAMES[t]; }

  /** Returns one line for the event, or null when muted. Throws if a template needs a fact the caller did not supply — the coach never invents. */
  line(event: CoachEvent, facts: CoachFacts): string | null {
    if (this.muted) return null;
    const variants: readonly string[] = templates.templates[event];
    const t = variants[Math.min(variants.length - 1, Math.floor(this.rng() * variants.length))]!;
    return t.replace(/\{(\w+)\}/g, (_, k: string) => {
      const v = facts[k];
      if (v === undefined || v === '') throw new Error(`coach template ${event} missing fact ${k}`);
      return String(v);
    });
  }
}

export const coachName = templates.persona.name;
