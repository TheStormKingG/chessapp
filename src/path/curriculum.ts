export interface UnitDef {
  id: string;
  title: string;
  lessons: { id: string; title: string }[];
  built: boolean;
}

/** PRD Appendix A, Section 1 (units 1.1 to 1.6). `built: false` means no content yet. */
export const SECTION_1: { id: string; title: string; band: string; units: UnitDef[] } = {
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
      built: false,
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
      built: false,
      lessons: [
        { id: '1.4.1', title: 'Castling both sides' },
        { id: '1.4.2', title: 'En passant again' },
        { id: '1.4.3', title: 'Touch move, draws, resigning, notation, the clock' },
      ],
    },
    {
      id: '1.5',
      title: 'Your first mates',
      built: false,
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
      built: false,
      lessons: [
        { id: '1.6.1', title: 'The three questions' },
        { id: '1.6.2', title: 'All checks and captures' },
        { id: '1.6.3', title: 'Your first full game with the coach' },
      ],
    },
  ],
};
