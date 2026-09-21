import type { Theme } from '@/puzzles/types';

export interface SectionDef {
  id: string;
  title: string;
  band: string;
  units: UnitDef[];
}

export interface UnitDef {
  id: string;
  title: string;
  lessons: { id: string; title: string }[];
  built: boolean;
}

/**
 * PRD Appendix A, Section 1 (units 1.1 to 1.6). `built: false` means no content
 * yet: that unit's lessons render as "Content coming" and its checkpoint is not
 * attemptable. All six units of Section 1 are authored, so all six are built.
 * The flag stays because Section 2 will arrive one unit at a time.
 */
export const SECTION_1: SectionDef = {
  id: '1',
  title: 'Foundations',
  band: 'New to 400',
  units: [
    {
      id: '1.1',
      title: 'The board and the pieces',
      built: true,
      lessons: [
        { id: '1.1.1', title: 'The board' },
        { id: '1.1.2', title: 'The rook' },
        { id: '1.1.3', title: 'The bishop' },
        { id: '1.1.4', title: 'The queen' },
        { id: '1.1.5', title: 'The king' },
        { id: '1.1.6', title: 'The knight' },
        { id: '1.1.7', title: 'The pawn, promotion and en passant' },
        { id: '1.1.8', title: 'Setting up the board' },
      ],
    },
    {
      id: '1.2',
      title: 'Capturing and value',
      built: true,
      lessons: [
        { id: '1.2.1', title: 'Attack, capture and defend' },
        { id: '1.2.2', title: 'Piece values' },
        { id: '1.2.3', title: 'Take free pieces' },
        { id: '1.2.4', title: 'Do not leave pieces free' },
        { id: '1.2.5', title: 'Counting attackers and defenders' },
      ],
    },
    {
      id: '1.3',
      title: 'Check, mate and draws',
      built: true,
      lessons: [
        { id: '1.3.1', title: 'Check and the three ways out' },
        { id: '1.3.2', title: 'Checkmate' },
        { id: '1.3.3', title: 'Mate in one' },
        { id: '1.3.4', title: 'Stalemate' },
        { id: '1.3.5', title: 'The three draws' },
      ],
    },
    {
      id: '1.4',
      title: 'Castling and the rules of play',
      built: true,
      lessons: [
        { id: '1.4.1', title: 'Castling both sides' },
        { id: '1.4.2', title: 'En passant again' },
        { id: '1.4.3', title: 'Touch move, draws, resigning, notation, the clock' },
      ],
    },
    {
      id: '1.5',
      title: 'Your first mates',
      built: true,
      lessons: [
        { id: '1.5.1', title: 'The ladder mate' },
        { id: '1.5.2', title: 'King and queen against king' },
        { id: '1.5.3', title: 'King and rook against king' },
        { id: '1.5.4', title: 'The back-rank mate' },
        { id: '1.5.5', title: "Meeting Scholar's and Fool's mate" },
      ],
    },
    {
      id: '1.6',
      title: 'Safety first',
      built: true,
      lessons: [
        { id: '1.6.1', title: 'The three questions' },
        { id: '1.6.2', title: 'All checks and captures' },
        { id: '1.6.3', title: 'Your first full game with the coach' },
      ],
    },
  ],
};

/**
 * PRD Appendix A, Section 2 (units 2.1 to 2.8). Declared ahead of its content:
 * every unit is `built: false` until its lessons, checkpoint and guidebook have
 * been authored and have passed `verify:content`, so a half-authored unit is
 * never reachable by a learner.
 *
 * Declaring the ids here is also what the puzzles spec's `themeForLesson` reads,
 * which is why this file is the one place the two specs touch.
 *
 * `pathNodes` walks this section like any other (`SECTIONS` below is the path
 * order), so its units render as a counted "coming" run under their own
 * Section 2 header and its rail meter counts Section 2's lessons alone. An
 * unbuilt unit is visible and un-attemptable, never active.
 */
export const SECTION_2: SectionDef = {
  id: '2',
  title: 'Safety and the first tactics',
  band: '400 to 800',
  units: [
    {
      id: '2.1',
      title: 'Real Chess',
      built: true,
      lessons: [
        { id: '2.1.1', title: "What does the opponent's last move threaten?" },
        { id: '2.1.2', title: 'The threat scan: checks, captures and threats for the opponent' },
        { id: '2.1.3', title: 'Hanging pieces on both sides' },
        { id: '2.1.4', title: 'Counting on a contested square' },
        { id: '2.1.5', title: 'The sanity check before you move' },
      ],
    },
    {
      id: '2.2',
      title: 'Forks',
      built: true,
      lessons: [
        { id: '2.2.1', title: 'The knight fork' },
        { id: '2.2.2', title: 'The pawn fork' },
        { id: '2.2.3', title: 'The queen fork and the family fork' },
        { id: '2.2.4', title: 'Setting up a fork with a check' },
      ],
    },
    {
      id: '2.3',
      title: 'Pins and skewers',
      built: true,
      lessons: [
        { id: '2.3.1', title: 'The absolute pin' },
        { id: '2.3.2', title: 'The relative pin' },
        { id: '2.3.3', title: 'Spotting a pin on both sides' },
        { id: '2.3.4', title: 'The skewer' },
        { id: '2.3.5', title: 'Keeping a pin rather than capturing early' },
      ],
    },
    {
      id: '2.4',
      title: 'Back-rank and helper mates',
      built: false,
      lessons: [
        { id: '2.4.1', title: 'The back-rank weakness and making an escape square' },
        { id: '2.4.2', title: 'Support mate' },
        { id: '2.4.3', title: 'Corridor mate' },
        { id: '2.4.4', title: 'Smothered mate, the pattern' },
        { id: '2.4.5', title: "Damiano's mate" },
      ],
    },
    {
      id: '2.5',
      title: 'Discovered attacks',
      built: false,
      lessons: [
        { id: '2.5.1', title: 'Discovered attack' },
        { id: '2.5.2', title: 'Discovered check' },
        { id: '2.5.3', title: 'Batteries on a line' },
      ],
    },
    {
      id: '2.6',
      title: 'Opening principles and your first opening',
      built: false,
      lessons: [
        { id: '2.6.1', title: 'Centre, development, castle early' },
        {
          id: '2.6.2',
          title: 'Do not move the same piece twice, do not bring the queen out early',
        },
        { id: '2.6.3', title: 'The Italian Game as White' },
        { id: '2.6.4', title: 'Meeting 1.e4 with 1...e5 and 1.d4 with 1...d5' },
        { id: '2.6.5', title: 'The target position' },
      ],
    },
    {
      id: '2.7',
      title: 'Endgame rules that decide games',
      built: false,
      lessons: [
        { id: '2.7.1', title: 'What can and cannot mate' },
        { id: '2.7.2', title: 'The rule of the square' },
        { id: '2.7.3', title: 'King in front of the pawn, and direct opposition' },
        { id: '2.7.4', title: 'The rook-pawn draw' },
        { id: '2.7.5', title: 'The promotion race' },
        { id: '2.7.6', title: 'Activate the king in the endgame' },
      ],
    },
    {
      id: '2.8',
      title: 'Notation, the clock and slow games',
      built: false,
      lessons: [
        { id: '2.8.1', title: 'Reading and writing full notation' },
        { id: '2.8.2', title: 'Using most of your time, and never playing a bad move fast' },
        { id: '2.8.3', title: 'Going over your own game to find the first mistake' },
      ],
    },
  ],
};

/**
 * The path, in order. Every consumer that walks the curriculum walks THIS --
 * `pathNodes`, the unit lookup below, the checkpoint's tested-out rule -- so
 * declaring a Section 3 is one array entry rather than a hunt for every place
 * `SECTION_1` was named.
 */
export const SECTIONS: SectionDef[] = [SECTION_1, SECTION_2];

/** The unit with this id, from whichever section declares it. */
export function unitById(id: string): UnitDef | undefined {
  for (const s of SECTIONS) {
    const u = s.units.find((x) => x.id === id);
    if (u) return u;
  }
  return undefined;
}

/**
 * F-PZ-2 d: every lesson whose idea IS one of the eight shipped puzzle motifs
 * links to the themed practice for it.
 *
 * WHY THIS IS A NEW MAP RATHER THAN AN INVERSION OF AN OLD ONE. The puzzles
 * plan said to derive this from the review feature's `THEME_LESSON` instead of
 * writing a second table. That map is a different relation: it takes a REVIEW
 * theme — `hung_piece`, `missed_capture`, `ignored_threat`, `missed_mate` — to
 * the lesson that teaches the habit. Inverting it yields review themes, only
 * one of which (`missed_mate`) has a counterpart among the eight puzzle themes
 * the packs are filtered on, and the other three would send a learner to
 * "themed practice" for a motif no pack carries. `curriculum.test.ts` asserts
 * the one point where the two maps meet, which is the drift the plan was
 * rightly worried about — it is just not a drift an inversion could have
 * prevented.
 *
 * Only Section 1 is authored, and only three of its lessons carry a motif; the
 * other five themes belong to Section 2, which is a separate spec and a
 * separate plan. Adding a lesson here is one line, and the tests check that
 * both ends of that line exist.
 */
export const LESSON_THEME: Record<string, Theme> = {
  // "Mate in one" — the mateIn1 pack is the same idea, drilled.
  '1.3.3': 'mateIn1',
  // "The back-rank mate".
  '1.5.4': 'backRankMate',
  // "Meeting Scholar's and Fool's mate" — both are the strike at f7 and f2.
  '1.5.5': 'attackingF2F7',
};

/**
 * The themed practice a lesson leads to, or null.
 *
 * Null is a real answer and the COMMON one: most lessons teach a habit or a
 * rule rather than a motif, and a link to a practice set that does not exist
 * is worse than no link.
 */
export function themeForLesson(lessonId: string): Theme | null {
  return LESSON_THEME[lessonId] ?? null;
}
