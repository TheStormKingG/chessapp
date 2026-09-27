import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { db } from '@/data/db';
import { newEvent } from '@/data/events';
import { Practice, TailoredSessionScreen } from './TailoredSessionScreen';
import type { PracticeItem } from './practiceSet';
import { useTailored } from './store';
import type { Verdict } from './verify';
import { ITALIAN_SANS, aReview } from './testReviews';

/**
 * The session, mounted. Everything asynchronous is either seeded (Dexie) or refused
 * (the puzzle pack's fetch, the engine gate), so nothing here touches the network and
 * nothing runs Stockfish.
 */

const NOW = new Date('2026-09-26T12:00:00.000Z');
const verified: Verdict = { verified: true, bestUci: 'd2d3', marginCp: 400 };
const refused: Verdict = { verified: false, reason: 'runner-up-too-close', marginCp: 20, engineBest: 'x' };

/** The real `waitFor` default is 1000ms, which is not enough for a dynamic import. */
const SLOW = { timeout: 15_000 };

async function seedGames(n: number, theme = 'hung_piece', offset = 0) {
  for (let i = offset; i < offset + n; i += 1) {
    const gameId = `g${String(i)}`;
    await db.reviews.add(
      aReview({
        gameId,
        sans: ITALIAN_SANS,
        errors: [{ ply: 6, theme, bestSan: 'd3' }],
      }),
    );
    await db.events.add(
      newEvent(
        { type: 'game_started', gameId, persona: 'rosa', color: 'w', timeControl: 'untimed', coach: true },
        new Date(NOW.getTime() - (i + 1) * 86_400_000),
      ),
    );
    await db.events.add(
      newEvent(
        { type: 'game_finished', gameId, result: 'loss', moves: 8, hints: 0, takebacks: 0, crowns: 0, pgn: '' },
        new Date(NOW.getTime() - (i + 1) * 86_400_000),
      ),
    );
  }
}

function mount(verify: (at: { fen: string; expectedUci: string }) => Promise<Verdict>) {
  return render(
    <MemoryRouter initialEntries={['/tailored']}>
      <TailoredSessionScreen verify={verify} now={NOW} />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  useTailored.getState().reset();
  await db.reviews.clear();
  await db.events.clear();
  await db.imported.clear();
  // The puzzle pack is a fetch. Refused, not mocked with data: the session must be
  // complete without it, and that is worth testing rather than papering over.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('no network in tests'))),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('when there is nothing to offer', () => {
  it('says a session needs games, rather than showing an empty one', async () => {
    mount(() => Promise.resolve(verified));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /no tailored session/i })).toBeInTheDocument();
    }, SLOW);
    expect(screen.getByText(/no weaknesses to work on yet/i)).toBeInTheDocument();
  });

  it('refuses a second session on a day that already has one', async () => {
    await seedGames(10);
    useTailored
      .getState()
      .record({ day: '2026-09-26', theme: 'hung_piece', lessonId: '1.2.4', signature: 'x' });
    mount(() => Promise.resolve(verified));
    await waitFor(() => {
      expect(screen.getByText(/already had a tailored session today/i)).toBeInTheDocument();
    }, SLOW);
  });
});

describe('the session it builds', () => {
  it('opens with F-TS-2’s one sentence and what is in it', async () => {
    await seedGames(10);
    mount(() => Promise.resolve(verified));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /today is tailored/i })).toBeInTheDocument();
    }, SLOW);
    // The reason names the weakness and the numbers the profile computed.
    expect(screen.getByText(/today is about leaving pieces free to take/i)).toBeInTheDocument();
    expect(screen.getByText(/10 times in 10 games/i)).toBeInTheDocument();
    // And it reports the verification rate rather than hiding it.
    expect(screen.getByText(/of your positions had a single clear answer/i)).toBeInTheDocument();
  });

  it('starts the lesson, records the day, and sets F-TS-6’s next check date', async () => {
    await seedGames(10);
    mount(() => Promise.resolve(verified));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /start the session/i })).toBeInTheDocument();
    }, SLOW);
    await userEvent.click(screen.getByRole('button', { name: /start the session/i }));
    // The authored lesson's card is what a tailored lesson opens on: F-TS-3 keeps it.
    await waitFor(() => {
      expect(screen.getByText(/Tailored: Do not leave pieces free/i)).toBeInTheDocument();
    }, SLOW);
    expect(useTailored.getState().taken.map((t) => t.day)).toEqual(['2026-09-26']);
    expect(useTailored.getState().nextCheck).toEqual({ theme: 'hung_piece', day: '2026-10-03' });
  });

  it('records the declined offer and does not start anything', async () => {
    await seedGames(10);
    mount(() => Promise.resolve(verified));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /not today/i })).toBeInTheDocument();
    }, SLOW);
    await userEvent.click(screen.getByRole('button', { name: /not today/i }));
    expect(useTailored.getState().declined).not.toBeNull();
    expect(useTailored.getState().taken).toEqual([]);
  });

  it('builds a session from the concept bank when the engine certifies nothing', async () => {
    // F-TS-4's fallback path, end to end: no own positions in the lesson, and the
    // session still opens with a full complement. Its positive control is the test
    // below, which mounts the same seed with the engine certifying.
    await seedGames(10);
    mount(() => Promise.resolve(refused));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /today is tailored/i })).toBeInTheDocument();
    }, SLOW);
    expect(screen.getByText(/0 positions of yours/i)).toBeInTheDocument();
  });

  it('uses the learner’s own positions when the engine certifies them', async () => {
    await seedGames(10);
    mount(() => Promise.resolve(verified));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /today is tailored/i })).toBeInTheDocument();
    }, SLOW);
    expect(screen.queryByText(/0 positions of yours/i)).not.toBeInTheDocument();
    expect(screen.getByText(/positions of yours/i)).toBeInTheDocument();
  });

  it('holds F-TS-7’s gate at nine games and opens it at ten', async () => {
    await seedGames(9);
    const first = mount(() => Promise.resolve(verified));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /no tailored session/i })).toBeInTheDocument();
    }, SLOW);
    expect(screen.getByText(/needs games to build from|play ten/i)).toBeInTheDocument();
    first.unmount();

    await seedGames(1, 'hung_piece', 9);
    mount(() => Promise.resolve(verified));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /today is tailored/i })).toBeInTheDocument();
    }, SLOW);
  });
});

describe('the practice stage', () => {
  const puzzleItem = (id: string): PracticeItem => ({
    kind: 'puzzle',
    puzzle: {
      id,
      fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
      solution: ['d2d3', 'f8c5'],
      rating: 900,
      themes: ['fork'],
    },
    firstLearnerPly: 1,
    origin: 'own',
    provenance: 'your game against Rosa on Tuesday',
  });

  it('plays the items in order and names where an own position came from', async () => {
    const done = vi.fn();
    render(
      <MemoryRouter>
        <Practice items={[puzzleItem('a'), puzzleItem('b')]} short={null} onDone={done} />
      </MemoryRouter>,
    );
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
    expect(screen.getByText(/from your game against rosa on tuesday/i)).toBeInTheDocument();
    // "Skip this one" is the stage's own control. The player's ✕ means something
    // else — see the comment on `onExit` — and this asserts they are not the same.
    await userEvent.click(screen.getByRole('button', { name: /skip this one/i }));
    expect(screen.getByText('2 of 2')).toBeInTheDocument();
    expect(done).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /skip this one/i }));
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('the player’s close control ends the run instead of advancing it', async () => {
    const done = vi.fn();
    render(
      <MemoryRouter>
        <Practice items={[puzzleItem('a'), puzzleItem('b')]} short={null} onDone={done} />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: /close puzzle/i }));
    expect(done).toHaveBeenCalledTimes(1);
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
  });

  it('says why there is nothing rather than showing an empty run', async () => {
    const done = vi.fn();
    render(
      <MemoryRouter>
        <Practice items={[]} short="the puzzle pack could not be loaded" onDone={done} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/puzzle pack could not be loaded/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /carry on/i }));
    expect(done).toHaveBeenCalledTimes(1);
  });
});
