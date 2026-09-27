import { describe, expect, it, vi } from 'vitest';
import { legalMoves } from '@/rules';
import type { Challenge, CheckpointBank, Lesson } from '@/lesson';
import { checkAnswer } from '@/lesson/answers';
import { initLesson, reduce } from '@/lesson/LessonMachine';
import type { Verdict } from './verify';
import { ITALIAN_SANS, anOwnGame } from './testReviews';
import { ownCandidates } from './ownPositions';
import { TAILORED_ID_PREFIX, buildTailoredLesson, conceptsOf, ownChallenge } from './tailoredLesson';

const NOW = new Date('2026-09-26T12:00:00.000Z');

function aChallenge(id: string, concept: string): Challenge {
  return {
    type: 'find_the_move',
    id,
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    prompt: 'Authored',
    concept,
    answer: { moves: ['e4'] },
  };
}

const AUTHORED: Lesson = {
  id: '1.2.4',
  unit: '1.2',
  title: 'Do not leave pieces free',
  xp: 20,
  card: { idea: 'Do not leave pieces free.', diagrams: ['fen1'], habit: 'Check what is loose.' },
  explain: [{ fen: 'fen2', text: 'Here is why.', highlights: ['e4'] }],
  challenges: [aChallenge('a1', 'loose-pieces'), aChallenge('a2', 'loose-pieces'), aChallenge('a3', 'counting')],
  takeaway: 'Look for loose pieces.',
};

const BANK: CheckpointBank = {
  unit: '1.2',
  title: 'Capturing and value checkpoint',
  passMark: 80,
  sample: 8,
  bank: [
    aChallenge('k1', 'loose-pieces'),
    aChallenge('k2', 'loose-pieces'),
    aChallenge('k3', 'a-different-idea'),
  ],
};

/** Two own candidates from a real game, ply 6 (Ng5) and ply 4 (Bc4). */
function candidates() {
  const game = anOwnGame({
    gameId: 'g1',
    sans: ITALIAN_SANS,
    errors: [
      { ply: 6, theme: 'hung_piece', bestSan: 'd3' },
      { ply: 4, theme: 'hung_piece', bestSan: 'd3' },
    ],
    playedAt: '2026-09-22T18:00:00.000Z',
  });
  return ownCandidates({ games: [game], theme: 'hung_piece', now: NOW });
}

const verified: Verdict = { verified: true, bestUci: 'x', marginCp: 300 };
const refused: Verdict = { verified: false, reason: 'runner-up-too-close', marginCp: 20, engineBest: 'x' };

describe('the authored teaching is not touched', () => {
  it('carries the card, explain screens, title, takeaway and xp across unchanged', async () => {
    const t = await buildTailoredLesson({
      authored: AUTHORED,
      bank: BANK,
      candidates: candidates(),
      verify: () => Promise.resolve(verified),
    });
    expect(t.lesson.card).toEqual(AUTHORED.card);
    expect(t.lesson.explain).toEqual(AUTHORED.explain);
    expect(t.lesson.title).toBe(AUTHORED.title);
    expect(t.lesson.takeaway).toBe(AUTHORED.takeaway);
    expect(t.lesson.xp).toBe(AUTHORED.xp);
  });

  it('gives the assembled lesson a distinct id, and remembers the authored one', async () => {
    const t = await buildTailoredLesson({
      authored: AUTHORED,
      bank: BANK,
      candidates: candidates(),
      verify: () => Promise.resolve(verified),
    });
    expect(t.lesson.id).toBe(`${TAILORED_ID_PREFIX}1.2.4`);
    expect(t.lesson.id).not.toBe(AUTHORED.id);
    expect(t.authoredId).toBe('1.2.4');
  });

  it('keeps the lesson the same length as the one it reassembles', async () => {
    const t = await buildTailoredLesson({
      authored: AUTHORED,
      bank: BANK,
      candidates: candidates(),
      verify: () => Promise.resolve(verified),
    });
    expect(t.lesson.challenges).toHaveLength(AUTHORED.challenges.length);
  });
});

describe('F-TS-3: own positions first, then the bank, then the authored challenges', () => {
  it('puts every verified own position at the front', async () => {
    const t = await buildTailoredLesson({
      authored: AUTHORED,
      bank: BANK,
      candidates: candidates(),
      verify: () => Promise.resolve(verified),
    });
    expect(t.own).toBe(2);
    expect(t.lesson.challenges.slice(0, 2).map((c) => c.id)).toEqual(['own-g1-6', 'own-g1-4']);
    // The third comes from the bank, filtered to a concept the lesson teaches.
    expect(t.lesson.challenges[2]?.id).toBe('k1');
    expect(t.fromBank).toBe(1);
    expect(t.fromAuthored).toBe(0);
  });

  it('falls back to the concept bank when nothing verifies', async () => {
    const t = await buildTailoredLesson({
      authored: AUTHORED,
      bank: BANK,
      candidates: candidates(),
      verify: () => Promise.resolve(refused),
    });
    expect(t.own).toBe(0);
    expect(t.lesson.challenges.map((c) => c.id)).toEqual(['k1', 'k2', 'a1']);
    expect(t.unverified).toHaveLength(2);
  });

  it('never draws a bank position whose concept the lesson does not teach', async () => {
    const t = await buildTailoredLesson({
      authored: AUTHORED,
      bank: BANK,
      candidates: [],
      verify: () => Promise.resolve(refused),
    });
    expect(t.lesson.challenges.map((c) => c.id)).not.toContain('k3');
    // Positive control: k3 IS in the bank, so its absence is the concept filter and
    // not an empty bank.
    expect(BANK.bank.map((c) => c.id)).toContain('k3');
  });

  it('falls all the way back to the authored challenges when there is no bank', async () => {
    const t = await buildTailoredLesson({
      authored: AUTHORED,
      bank: null,
      candidates: [],
      verify: () => Promise.resolve(refused),
    });
    expect(t.lesson.challenges).toEqual(AUTHORED.challenges);
    expect(t.fromAuthored).toBe(3);
  });

  it('produces unique challenge ids, because the player keys results on them', async () => {
    const t = await buildTailoredLesson({
      authored: AUTHORED,
      bank: BANK,
      candidates: candidates(),
      verify: () => Promise.resolve(verified),
    });
    const ids = t.lesson.challenges.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('stops asking the engine once the lesson is full', async () => {
    const many = [...candidates(), ...candidates(), ...candidates()];
    const verify = vi.fn().mockResolvedValue(verified);
    const t = await buildTailoredLesson({ authored: AUTHORED, bank: BANK, candidates: many, verify });
    expect(t.own).toBe(3);
    // Three searches, not six: each one is a depth-14 search on a phone.
    expect(verify).toHaveBeenCalledTimes(3);
  });

  it('offers at most MAX_CANDIDATES positions to the engine', async () => {
    // A long history must not turn into forty searches before a session opens.
    const long = Array.from({ length: 40 }, () => candidates()[0]).filter((c) => c !== undefined);
    const verify = vi.fn().mockResolvedValue(refused);
    await buildTailoredLesson({ authored: AUTHORED, bank: BANK, candidates: long, verify });
    expect(verify).toHaveBeenCalledTimes(12);
  });

  it('reports the verification rate it observed', async () => {
    let n = 0;
    const t = await buildTailoredLesson({
      authored: AUTHORED,
      bank: BANK,
      candidates: candidates(),
      verify: () => Promise.resolve((n += 1) === 1 ? verified : refused),
    });
    expect(t.rate).toEqual({ checked: 2, verified: 1, reasons: { 'runner-up-too-close': 1 } });
  });
});

describe('an own challenge is playable', () => {
  const [c] = candidates();

  it('is a find_the_move over the position before the mistake', () => {
    expect(c).toBeDefined();
    const ch = ownChallenge(c!, 'loose-pieces');
    expect(ch.type).toBe('find_the_move');
    expect(ch.fen).toBe(c?.fen);
    expect(ch.concept).toBe('loose-pieces');
  });

  it('accepts the answer in both notations, which is what the player grades against', () => {
    const ch = ownChallenge(c!, 'loose-pieces');
    if (ch.type !== 'find_the_move') throw new Error('wrong type');
    // The real grader, not a re-implementation of it.
    expect(checkAnswer(ch, { kind: 'move', uci: c?.bestUci ?? '' }).correct).toBe(true);
    // And a legal move that is NOT the answer is wrong — the control that shows the
    // assertion above is not passing because everything passes.
    const other = legalMoves(c?.fen ?? '').find((m) => m.uci !== c?.bestUci);
    expect(checkAnswer(ch, { kind: 'move', uci: other?.uci ?? '' }).correct).toBe(false);
  });

  it('states the opponent’s move over the position it produced', () => {
    const ch = ownChallenge(c!, 'loose-pieces');
    expect(ch.prompt).toContain('Nf6');
    expect(ch.prompt).toContain('left a piece to be taken');
  });

  it('is revealed in a notation a learner reads, not in UCI', async () => {
    // Driven through the real reducer: `revealText` prints `answer.moves[0]`
    // verbatim, so this is the only way to find out what the learner is actually
    // told. With the UCI in that slot the sentence reads "The answer is f2f3."
    const t = await buildTailoredLesson({
      authored: AUTHORED,
      bank: null,
      candidates: candidates(),
      verify: () => Promise.resolve(verified),
    });
    let s = initLesson(t.lesson);
    while (s.phase.kind !== 'challenge') s = reduce(s, { type: 'next' });
    s = reduce(s, { type: 'reveal' });
    expect(s.feedback).toContain(`The answer is ${c?.bestSan ?? ''}.`);
    expect(s.feedback).not.toContain(c?.bestUci ?? 'g1f3');
  });

  it('names the game in the feedback, F-TS-3’s coach line', () => {
    const ch = ownChallenge(c!, 'loose-pieces');
    expect(ch.reason).toContain('your game against Rosa on Tuesday');
    expect(ch.reason).toContain('Ng5');
  });

  it('drops the opponent sentence when there was no previous move', () => {
    const first = ownCandidates({
      games: [anOwnGame({ gameId: 'g2', sans: ITALIAN_SANS, errors: [{ ply: 0, theme: 'hung_piece', bestSan: 'd4' }] })],
      theme: 'hung_piece',
      now: NOW,
    });
    expect(ownChallenge(first[0]!, 'x').prompt).not.toContain('has just played');
    // Control: the candidate WITH a lead does contain it.
    expect(ownChallenge(c!, 'x').prompt).toContain('has just played');
  });

  it('uses a prompt of its own for a theme it has no wording for', () => {
    const unclassified = ownCandidates({
      games: [anOwnGame({ gameId: 'g3', sans: ITALIAN_SANS, errors: [{ ply: 6, theme: 'unclassified', bestSan: 'd3' }] })],
      theme: 'unclassified',
      now: NOW,
    });
    expect(ownChallenge(unclassified[0]!, 'x').prompt).toContain('There was a better move here');
  });
});

describe('conceptsOf', () => {
  it('lists the concepts the lesson teaches, once each, in order', () => {
    expect(conceptsOf(AUTHORED)).toEqual(['loose-pieces', 'counting']);
  });
});
