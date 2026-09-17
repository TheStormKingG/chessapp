import type { Square } from '@/rules';

export type ChallengeType =
  | 'find_the_move'
  | 'find_the_sequence'
  | 'find_them_all'
  | 'is_it_safe'
  | 'which_square'
  | 'name_the_pattern'
  | 'play_it_out'
  | 'guess_the_move';

export interface Hints {
  piece?: Square;
  square?: Square;
}

interface Base {
  id: string;
  fen: string;
  prompt: string;
  hints?: Hints;
  reason?: string;
  concept: string;
}

export type Challenge =
  | (Base & { type: 'find_the_move'; answer: { moves: string[] }; wrong?: Record<string, string> })
  | (Base & { type: 'find_the_sequence'; answer: { line: string[] }; wrong?: Record<string, string> })
  // Design spec 4.7 / PRD 7.4: mark every square OR every piece that fits.
  // A piece is identified by the square it stands on.
  | (Base & { type: 'find_them_all'; answer: { squares: Square[] } | { pieces: Square[] } })
  | (Base & {
      type: 'is_it_safe';
      move: string;
      answer: { safe: boolean; reason: number };
      reasons: [string, string, string];
    })
  | (Base & { type: 'which_square'; answer: { square: Square }; timeLimitS?: number })
  | (Base & { type: 'name_the_pattern'; options: [string, string, string]; answer: { option: number } })
  | (Base & {
      type: 'play_it_out';
      goal: { kind: 'mate_in' | 'promote' | 'capture_all' | 'hold'; moves: number };
      opponentDepth?: number;
    })
  | (Base & { type: 'guess_the_move'; answer: { moves: string[] }; commentary: string });

export interface Lesson {
  id: string;
  unit: string;
  title: string;
  xp: number;
  card: { idea: string; diagrams: string[]; habit?: string };
  explain: { fen: string; text: string; arrows?: [Square, Square][]; highlights?: Square[] }[];
  challenges: Challenge[];
  takeaway: string;
}

export interface CheckpointBank {
  unit: string;
  title: string;
  passMark: number;
  sample: number;
  bank: Challenge[];
}

export interface UnitGuide {
  unit: string;
  title: string;
  lessons: string[];
  guidebook: string;
}
