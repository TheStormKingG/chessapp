import type { Square } from '@/rules';
import { checkAnswer, type Attempt } from './answers';
import { stars } from './stars';
import type { Challenge, Lesson } from './types';

export type ChallengeStatus = 'attempting' | 'retry' | 'correct' | 'revealed';

export type Phase =
  | { kind: 'card' }
  | { kind: 'explain'; index: number }
  | { kind: 'challenge'; index: number; status: ChallengeStatus }
  | { kind: 'close'; stars: 1 | 2 | 3; xp: number };

type ChallengePhase = Extract<Phase, { kind: 'challenge' }>;

export interface ChallengeResult {
  correct: boolean;
  hints: number;
  misses: number;
  mastery: boolean;
}

export type Highlights = Partial<Record<Square, 'accent' | 'review' | 'danger' | 'selected'>>;

/** One press of Hint: either a square to light up or a sentence to say. */
export interface HintStage {
  square?: Square;
  text?: string;
}

/**
 * The hint stages a challenge actually has, in order, at most two (PRD 7.3).
 * A square that repeats the previous stage's square is not a stage: the second
 * hint has to say something the first did not, or it is not offered at all.
 */
export function hintStages(c: Challenge): HintStage[] {
  const h = c.hints;
  if (!h) return [];
  const out: HintStage[] = [];
  if (h.piece) out.push({ square: h.piece });
  if (h.square && h.square !== h.piece) out.push({ square: h.square });
  if (h.text) out.push({ text: h.text });
  if (h.text2) out.push({ text: h.text2 });
  return out.slice(0, 2);
}

export interface LessonState {
  lesson: Lesson;
  phase: Phase;
  hintLevel: 0 | 1 | 2;
  hintsAllowed: boolean;
  /**
   * Whether pressing Hint right now would actually show the learner something.
   * False when hints are switched off (checkpoints), when the phase takes no
   * answer, when the challenge authors no hint, and when every stage it does
   * author has already been spent. The player must disable the control on
   * false: an enabled control that does nothing is help the app cannot give.
   */
  hintAvailable: boolean;
  results: Record<string, ChallengeResult>;
  feedback: string | null;
  feedbackTone: 'neutral' | 'good' | 'bad';
  highlights: Highlights;
  refutation: { from: Square; to: Square } | null;
  totalHints: number;
  totalMisses: number;
}

export type Action =
  | { type: 'next' }
  | { type: 'hint' }
  | { type: 'attempt'; attempt: Attempt }
  | { type: 'miss'; san: string }
  | { type: 'reveal' }
  | { type: 'engineRefutation'; from: Square; to: Square; text: string };

const EMPTY_RESULT: ChallengeResult = { correct: false, hints: 0, misses: 0, mastery: false };

export function initLesson(lesson: Lesson, hintsAllowed = true): LessonState {
  return {
    lesson,
    phase: { kind: 'card' },
    hintLevel: 0,
    hintsAllowed,
    hintAvailable: false,
    results: {},
    feedback: null,
    feedbackTone: 'neutral',
    highlights: {},
    refutation: null,
    totalHints: 0,
    totalMisses: 0,
  };
}

export function currentChallenge(s: LessonState): Challenge | null {
  return s.phase.kind === 'challenge' ? (s.lesson.challenges[s.phase.index] ?? null) : null;
}

function startChallenge(s: LessonState, index: number): LessonState {
  return {
    ...s,
    phase: { kind: 'challenge', index, status: 'attempting' },
    hintLevel: 0,
    feedback: null,
    feedbackTone: 'neutral',
    highlights: {},
    refutation: null,
  };
}

function finish(s: LessonState): LessonState {
  const st = stars({ hints: s.totalHints, misses: s.totalMisses });
  return {
    ...s,
    phase: { kind: 'close', stars: st, xp: s.lesson.xp },
    highlights: {},
    feedback: s.lesson.takeaway,
    feedbackTone: 'neutral',
  };
}

function resultOf(s: LessonState, id: string): ChallengeResult {
  return s.results[id] ?? EMPTY_RESULT;
}

/** The challenge, when the machine is in a state that accepts an answer. */
function answerable(s: LessonState): { c: Challenge; p: ChallengePhase } | null {
  const p = s.phase;
  if (p.kind !== 'challenge') return null;
  if (p.status !== 'attempting' && p.status !== 'retry') return null;
  const c = currentChallenge(s);
  return c ? { c, p } : null;
}

/**
 * Shared wrong-answer handling (PRD 7.3): first miss gives feedback and a retry,
 * a second miss reveals the solution. `authored` is the lesson's own line for
 * this specific wrong move, when one exists.
 */
function applyMiss(
  s: LessonState,
  p: ChallengePhase,
  c: Challenge,
  authored?: string,
  detail?: { missing?: Square[]; extra?: Square[] },
): LessonState {
  const r = resultOf(s, c.id);
  const misses = r.misses + 1;
  const results = { ...s.results, [c.id]: { ...r, misses, mastery: false } };
  const totalMisses = s.totalMisses + 1;
  if (misses >= 2) {
    return {
      ...s,
      phase: { ...p, status: 'revealed' },
      results,
      totalMisses,
      feedback: revealText(c),
      feedbackTone: 'neutral',
      highlights: revealHighlights(c),
      refutation: null,
    };
  }
  return {
    ...s,
    phase: { ...p, status: 'retry' },
    results,
    totalMisses,
    feedback: authored ?? missFeedback(detail),
    feedbackTone: 'bad',
  };
}

function missFeedback(detail?: { missing?: Square[]; extra?: Square[] }): string {
  const missing = detail?.missing?.length ?? 0;
  const extra = detail?.extra?.length ?? 0;
  if (missing === 0 && extra === 0) return 'Not that one. Try again.';
  const parts = ['Not quite.'];
  if (missing > 0) parts.push(`You missed ${missing}.`);
  if (extra > 0) parts.push(`${extra} of those don't belong.`);
  return parts.join(' ');
}

/** Authored feedback map for the wrong move `san`, for challenge types that carry one. */
function authoredWrong(c: Challenge, san: string): string | undefined {
  if (c.type === 'find_the_move' || c.type === 'find_the_sequence') return c.wrong?.[san];
  return undefined;
}

/**
 * `hintAvailable` is a function of the rest of the state, so it is recomputed
 * on every transition rather than maintained by each case. Keeping it a field
 * (not a helper the player must remember to call) is what lets the player
 * disable the control without knowing how hints are authored.
 */
function syncHintAvailability(s: LessonState): LessonState {
  const ctx = answerable(s);
  const hintAvailable = !!ctx && s.hintsAllowed && hintStages(ctx.c).length > s.hintLevel;
  return hintAvailable === s.hintAvailable ? s : { ...s, hintAvailable };
}

export function reduce(s: LessonState, a: Action): LessonState {
  return syncHintAvailability(reduceInner(s, a));
}

function reduceInner(s: LessonState, a: Action): LessonState {
  const p = s.phase;
  switch (a.type) {
    case 'next': {
      if (p.kind === 'card') {
        return s.lesson.explain.length ? { ...s, phase: { kind: 'explain', index: 0 } } : startChallenge(s, 0);
      }
      if (p.kind === 'explain') {
        return p.index + 1 < s.lesson.explain.length
          ? { ...s, phase: { kind: 'explain', index: p.index + 1 } }
          : startChallenge(s, 0);
      }
      if (p.kind === 'challenge' && (p.status === 'correct' || p.status === 'revealed')) {
        return p.index + 1 < s.lesson.challenges.length ? startChallenge(s, p.index + 1) : finish(s);
      }
      return s;
    }
    case 'hint': {
      const ctx = answerable(s);
      if (!ctx || !s.hintsAllowed || s.hintLevel >= 2) return s;
      const { c } = ctx;
      // Nothing left to show: the press is a no-op and is not charged. The
      // player is told this in advance through `hintAvailable`.
      const stage = hintStages(c)[s.hintLevel];
      if (!stage) return s;
      const level = (s.hintLevel + 1) as 1 | 2;
      const r = resultOf(s, c.id);
      return {
        ...s,
        hintLevel: level,
        totalHints: s.totalHints + 1,
        ...(stage.square ? { highlights: { [stage.square]: 'accent' } as Highlights } : {}),
        ...(stage.text ? { feedback: stage.text, feedbackTone: 'neutral' as const } : {}),
        results: { ...s.results, [c.id]: { ...r, hints: r.hints + 1, mastery: false } },
      };
    }
    case 'attempt': {
      const ctx = answerable(s);
      if (!ctx) return s;
      const { c, p: cp } = ctx;
      const r = resultOf(s, c.id);
      const v = checkAnswer(c, a.attempt);
      if (v.correct) {
        // Mastery means the learner got it right unaided and first time:
        // no hint (F-PZ-4) and no miss. A checkpoint counts mastery, not mere
        // completion (PRD 6.4), so a guess followed by the right answer must
        // not score — the retry is a teaching move, not a pass.
        const mastery = r.hints === 0 && r.misses === 0;
        return {
          ...s,
          phase: { ...cp, status: 'correct' },
          feedback: c.reason ?? 'Yes.',
          feedbackTone: 'good',
          highlights: {},
          refutation: null,
          results: { ...s.results, [c.id]: { ...r, correct: true, mastery } },
        };
      }
      return applyMiss(s, cp, c, v.authored, { ...(v.missing ? { missing: v.missing } : {}), ...(v.extra ? { extra: v.extra } : {}) });
    }
    case 'miss': {
      const ctx = answerable(s);
      if (!ctx) return s;
      return applyMiss(s, ctx.p, ctx.c, authoredWrong(ctx.c, a.san));
    }
    case 'engineRefutation':
      return p.kind === 'challenge' && p.status === 'retry'
        ? { ...s, refutation: { from: a.from, to: a.to }, feedback: a.text }
        : s;
    case 'reveal': {
      const ctx = answerable(s);
      if (!ctx) return s;
      const { c, p: cp } = ctx;
      const r = resultOf(s, c.id);
      return {
        ...s,
        phase: { ...cp, status: 'revealed' },
        results: { ...s.results, [c.id]: { ...r, mastery: false } },
        feedback: revealText(c),
        feedbackTone: 'neutral',
        highlights: revealHighlights(c),
        refutation: null,
      };
    }
  }
}

function revealText(c: Challenge): string {
  switch (c.type) {
    case 'find_the_move':
    case 'guess_the_move':
      return `The answer is ${c.answer.moves[0] ?? '?'}. ${c.reason ?? ''}`.trim();
    case 'find_the_sequence':
      return `The line starts ${c.answer.line[0] ?? '?'}. ${c.reason ?? ''}`.trim();
    case 'which_square':
      return `That square is ${c.answer.square}. ${c.reason ?? ''}`.trim();
    case 'find_them_all':
      return `Here they all are. ${c.reason ?? ''}`.trim();
    case 'name_the_pattern':
      return `It is ${c.options[c.answer.option] ?? '?'}. ${c.reason ?? ''}`.trim();
    case 'is_it_safe':
      return `${c.answer.safe ? 'Safe' : 'Not safe'}: ${c.reasons[c.answer.reason] ?? ''}`.trim();
    case 'play_it_out':
      return `Here is the idea. ${c.reason ?? ''}`.trim();
  }
}

function revealHighlights(c: Challenge): Highlights {
  if (c.type === 'find_them_all') {
    const h: Highlights = {};
    const marked = 'squares' in c.answer ? c.answer.squares : c.answer.pieces;
    for (const sq of marked) h[sq] = 'accent';
    return h;
  }
  if (c.type === 'which_square') return { [c.answer.square]: 'accent' };
  if (c.hints?.square) {
    const h: Highlights = { [c.hints.square]: 'accent' };
    if (c.hints.piece) h[c.hints.piece] = 'selected';
    return h;
  }
  return {};
}
