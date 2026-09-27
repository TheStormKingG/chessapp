import { useEffect, useState } from 'react';
import { db } from '@/data/db';
import { localDay } from '@/data/events';
import { useProgress } from '@/data';
import { loadCheckpoint, loadLesson } from '@/lesson/loader';
import type { CheckpointBank, Lesson } from '@/lesson';
import { bandFor, loadPack } from '@/puzzles/packs';
import type { Puzzle } from '@/puzzles/types';
import { NO_BAND_STATS, buildProfile, profileGamesFrom, profileSignature } from '@/profile';
import { getEngine } from '@/engine';
import { useImportSettings } from '@/import/settings';
import { ROSA } from '@/play/useGame';
import { reachedUnit } from './band';
import { type SessionTarget, chooseTarget } from './choose';
import { type OfferReason, type SessionSize, offerDecision, sizeFor } from './buildSession';
import { opponentNames, ownCandidates, type OwnGame } from './ownPositions';
import { type PracticeSet, buildPracticeSet, solvedThemes } from './practiceSet';
import { type TailoredLesson, buildTailoredLesson } from './tailoredLesson';
import { type TargetedGame, targetedGame } from './targetedGame';
import { firstSessionDue, gameCounts } from './seed';
import { useTailored } from './store';
import { type Verdict, verifyPosition } from './verify';
import { useOnboarding } from '@/onboarding/store';

/**
 * Everything a tailored session needs, read once and assembled.
 *
 * ── WHY ALL OF IT IS HERE AND NONE OF IT IS IN THE SCREEN ────────────────────
 *
 * Four systems feed a session — the profile, the lesson corpus, the puzzle packs and
 * the learner's reviews — and each is a different kind of read (a projection, a
 * dynamic import, a fetch, three Dexie tables). Assembling them in the screen would
 * put four failure modes into a render, and the screen's job is to say which of them
 * happened.
 *
 * The engine is injectable for one reason: a test must never run Stockfish. It is not
 * a seam for anything else.
 */

export interface Session {
  target: SessionTarget;
  lesson: TailoredLesson;
  practice: PracticeSet;
  game: TargetedGame;
  size: SessionSize;
  /** The profile signature this session was built for, for the store. */
  signature: string;
  /** How many games the profile rests on, for the honesty line. */
  games: number;
  /** The learner's occurrences per game of the target theme, before this session. */
  previousPerGame: number | null;
}

export type SessionState =
  | { status: 'loading' }
  | { status: 'unavailable'; reason: OfferReason | 'error'; note: string }
  | { status: 'ready'; session: Session };

export interface SessionOptions {
  /** Injected in tests. Defaults to the real engine gate. */
  verify?: (at: { fen: string; expectedUci: string }) => Promise<Verdict>;
  now?: Date;
  /** Which weakness to train, when the learner picked one. */
  theme?: string | null;
}

/** A pack that will not load is not fatal: own positions are drills in their own right. */
async function packOrEmpty(rating: number): Promise<readonly Puzzle[]> {
  try {
    return await loadPack(bandFor(rating));
  } catch {
    return [];
  }
}

/** The unit's held-out bank, or null. A missing bank costs variety, never the session. */
async function bankOrNull(unit: string): Promise<CheckpointBank | null> {
  try {
    return await loadCheckpoint(unit);
  } catch {
    return null;
  }
}

export function useTailoredSession(options: SessionOptions = {}): SessionState {
  const progress = useProgress((s) => s.progress);
  const includeBullet = useImportSettings((s) => s.includeBullet);
  const dailyGoal = useOnboarding((s) => s.dailyGoal);
  const taken = useTailored((s) => s.taken);
  const declined = useTailored((s) => s.declined);
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  const wantedTheme = options.theme ?? null;
  const verify = options.verify;
  const nowMs = options.now?.getTime();

  useEffect(() => {
    let live = true;
    const now = nowMs === undefined ? new Date() : new Date(nowMs);
    const today = localDay(now);
    const gate =
      verify ?? ((at: { fen: string; expectedUci: string }) => verifyPosition(getEngine(), at));

    const run = async (): Promise<SessionState> => {
      const [reviews, imported, events] = await Promise.all([
        db.reviews.toArray(),
        db.imported.toArray(),
        db.events.toArray(),
      ]);
      const { games } = profileGamesFrom({ reviews, imported, events });
      const profile = buildProfile(games, { rating: null, source: NO_BAND_STATS, includeBullet });
      const signature = profileSignature(profile);
      const reached = reachedUnit(progress);

      // The learner's pick first, then F-SW-3's ranking. Picking a weakness from the
      // profile screen must land on that weakness, not on whatever is costliest now.
      const ordered =
        wantedTheme === null
          ? profile.weaknesses
          : [...profile.weaknesses].sort((a, b) =>
              a.theme === wantedTheme ? -1 : b.theme === wantedTheme ? 1 : 0,
            );
      const choice = chooseTarget({ weaknesses: ordered, reached });

      const counts = gameCounts({
        reviewedGameIds: reviews.map((r) => r.gameId),
        importedGameIds: new Set(imported.map((r) => r.gameId)),
      });
      const offer = offerDecision({
        signature,
        declined,
        taken,
        today,
        firstSessionDue: firstSessionDue(counts),
        hasTarget: choice.target !== null,
        // Arriving on this screen IS the learner asking. The automatic offer on Today
        // is the capped path; see buildSession.ts.
        onDemand: true,
      });
      if (!offer.offered || choice.target === null) {
        return {
          status: 'unavailable',
          reason: offer.reason,
          note: choice.noTarget ?? noteFor(offer.reason, offer.swap.nextEligibleDay),
        };
      }

      const target = choice.target;
      const authored: Lesson = await loadLesson(target.lessonId);
      const names = opponentNames({ imported, events, personaNames: { [ROSA.id]: ROSA.name } });
      // Newest first, the order buildProfile established and the profile weighted by.
      const ownGames: OwnGame[] = profile.gameIds
        .map((id) => games.find((g) => g.gameId === id))
        .filter((g): g is (typeof games)[number] => g !== undefined)
        .map((g) => ({
          gameId: g.gameId,
          playedAt: g.playedAt,
          opponent: names.get(g.gameId) ?? null,
          review: g.review,
        }));
      const candidates = ownCandidates({ games: ownGames, theme: target.primary.theme, now });

      const size = sizeFor(dailyGoal);
      const [bank, pool] = await Promise.all([
        bankOrNull(authored.unit),
        packOrEmpty(progress.puzzleRating.rating),
      ]);

      const lesson = await buildTailoredLesson({ authored, bank, candidates, verify: gate });
      const practice = await buildPracticeSet({
        // The lesson used the earliest candidates; the set starts where it left off, so
        // the learner is not asked the same position twice in one session.
        candidates: candidates.slice(lesson.own),
        theme: target.primary.theme,
        pool,
        rating: progress.puzzleRating,
        seen: new Set(seenPuzzleIds(events)),
        strengths: solvedThemes(events),
        verify: gate,
        size: size.puzzles,
      });
      const game = targetedGame({ games: ownGames, theme: target.primary.theme, now });

      return {
        status: 'ready',
        session: {
          target,
          lesson,
          practice,
          game,
          size,
          signature,
          games: profile.games,
          previousPerGame:
            profile.games === 0 ? null : target.primary.occurrences / profile.games,
        },
      };
    };

    run()
      .then((s) => {
        if (live) setState(s);
      })
      .catch(() => {
        if (live) {
          setState({
            status: 'unavailable',
            reason: 'error',
            note: 'This session could not be built. Your progress is untouched.',
          });
        }
      });
    return () => {
      live = false;
    };
    // `progress` is read for the band and the puzzle rating only; a rebuild on every
    // XP change would re-run four loads and a dozen engine searches mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedTheme, includeBullet, dailyGoal, verify, nowMs]);

  return state;
}

function seenPuzzleIds(events: readonly { payload: { type: string } }[]): string[] {
  const out: string[] = [];
  for (const e of events) {
    const p = e.payload as { type: string; puzzleId?: string };
    if (p.type === 'puzzle_attempted' && p.puzzleId !== undefined) out.push(p.puzzleId);
  }
  return out;
}

function noteFor(reason: OfferReason | 'error', nextDay: string | null): string {
  switch (reason) {
    case 'already-today':
      return 'You have already had a tailored session today. The path is what is next.';
    case 'quota-reached':
      return `Two this week is the limit, so the path keeps moving.${nextDay === null ? '' : ` The next one is available on ${nextDay}.`}`;
    case 'too-early':
      return 'A tailored session needs games to build from. Play ten, or import yours.';
    case 'no-target':
      return 'There is nothing in the profile to drill yet.';
    case 'declined':
      return 'You turned this one down. It will come back when the profile changes.';
    case 'unchanged':
      return 'Nothing has changed since your last session.';
    case 'error':
      return 'This session could not be built.';
    default:
      return 'No tailored session right now.';
  }
}
