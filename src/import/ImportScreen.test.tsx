import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { db } from '@/data/db';
import { emptyProgress } from '@/data/reduce';
import { useProgress } from '@/data';
import { ReviewScreen } from '@/review';
import { ImportScreen } from './ImportScreen';
import { ReviewListScreen } from './ReviewListScreen';
import { useImportSettings } from './settings';
import { storeImported } from './storage';
import type { ImportedGame } from './types';

/*
 * The engine is faked. Analysis itself is covered by src/review's own suite; what
 * these tests are about is the screen — the PGN paste path, the progress bar, the
 * plain-words failures and the listing.
 */
const engine = vi.hoisted(() => ({ analyse: vi.fn() }));
vi.mock('@/engine', async (orig) => ({
  ...(await orig<typeof import('@/engine')>()),
  getEngine: () => engine,
}));

beforeEach(async () => {
  await db.imported.clear();
  await db.archives.clear();
  await db.events.clear();
  await db.reviews.clear();
  useProgress.setState({ progress: emptyProgress(), loaded: true });
  useImportSettings.setState({ accounts: [], includeBullet: false, keepCurrent: true, lastCheckedAt: null });
  engine.analyse.mockReset();
  // A cheap, always-available answer, so analysis completes without a worker.
  engine.analyse.mockResolvedValue({ lines: [{ move: 'e2e4', pv: ['e2e4'], score: { cp: 20 }, depth: 10 }], depth: 10 });
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

const PGN = `[Event "Live Chess"]
[White "learner_one"]
[Black "Rosa"]
[Result "1-0"]
[UTCDate "2026.09.20"]
[UTCTime "14:00:00"]
[TimeControl "600"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0`;

function at(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('ImportScreen, the PGN paste path', () => {
  test('the screen offers both sources and says no password is asked for', () => {
    at(<ImportScreen />);
    expect(screen.getByRole('heading', { level: 1, name: /import your games/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /paste a pgn/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /from a username/i })).toBeInTheDocument();
    // F-IM-1: "No password for either site is ever requested." Saying so is the
    // only way the learner knows.
    expect(screen.getByText(/never ask for your password/i)).toBeInTheDocument();
  });

  test('no password field exists anywhere on the screen', async () => {
    at(<ImportScreen />);
    await userEvent.click(screen.getByRole('tab', { name: /from a username/i }));
    // There is no ARIA role for a password input, so the query has to be on the
    // type attribute rather than on a role.
    expect(document.querySelector('input[type="password"]')).toBeNull();
    // Positive control: the username field IS found by an equivalent query, so the
    // null above is the absence of a password field and not a broken query.
    expect(screen.getByLabelText(/your username there/i)).toBeInTheDocument();
  });

  test('the import button is disabled until something is pasted', async () => {
    at(<ImportScreen />);
    const button = screen.getByRole('button', { name: /import these games/i });
    expect(button).toBeDisabled();
    // `paste`, not `type`: a PGN's square brackets are key descriptors to
    // userEvent's keyboard parser, which throws on them.
    await userEvent.click(screen.getByLabelText(/your games, in pgn/i));
    await userEvent.paste(PGN);
    expect(button).toBeEnabled();
  });

  test('pasting a game imports it, analyses it, and says so', async () => {
    at(<ImportScreen />);
    // `paste` rather than `type`: the PGN contains bracket characters that
    // userEvent.type interprets as key descriptors.
    await userEvent.click(screen.getByLabelText(/your games, in pgn/i));
    await userEvent.paste(PGN);
    await userEvent.click(screen.getByRole('button', { name: /import these games/i }));

    await waitFor(() => {
      expect(screen.getByText(/1 game imported/i)).toBeInTheDocument();
    });
    // The outcome card reads Dexie for the next batch size; waiting for the button
    // it produces settles that update inside act() rather than after the test.
    await screen.findByRole('button', { name: /import 50 more/i });
    expect(await db.imported.count()).toBe(1);
    const row = (await db.imported.toArray())[0]!;
    expect(row.source).toBe('pgn');
    expect(row.opponent).toBe('Rosa');
    expect(row.result).toBe('win');
    // F-IM-3: the game was analysed, not merely stored.
    expect(row.analysis).toBe('done');
    // F-IM-6: the review the learner can now open actually exists.
    expect(await db.reviews.get(row.gameId)).not.toBeUndefined();
  });

  test('the PGN path works with no network at all', async () => {
    // `fetch` rejects for every call in this file, so a path that needed the
    // network would fail here rather than pass.
    at(<ImportScreen />);
    await userEvent.click(screen.getByLabelText(/your games, in pgn/i));
    await userEvent.paste(PGN);
    await userEvent.click(screen.getByRole('button', { name: /import these games/i }));
    await waitFor(() => {
      expect(screen.getByText(/1 game imported/i)).toBeInTheDocument();
    });
    // The outcome card reads Dexie for the next batch size; waiting for the button
    // it produces settles that update inside act() rather than after the test.
    await screen.findByRole('button', { name: /import 50 more/i });
  });

  test('a progress bar is shown while analysing, with a real aria value', async () => {
    // The engine is held until the test releases it, so the analysing state is
    // observable rather than raced past.
    let release = () => undefined as void;
    const held = new Promise<void>((r) => {
      release = () => {
        r();
      };
    });
    engine.analyse.mockImplementation(async () => {
      await held;
      return { lines: [{ move: 'e2e4', pv: ['e2e4'], score: { cp: 20 }, depth: 10 }], depth: 10 };
    });

    at(<ImportScreen />);
    await userEvent.click(screen.getByLabelText(/your games, in pgn/i));
    await userEvent.paste(PGN);
    await userEvent.click(screen.getByRole('button', { name: /import these games/i }));

    const bar = await screen.findByRole('progressbar', { name: /analysis progress/i });
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(Number(bar.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(0);
    release();
    await waitFor(() => {
      expect(screen.getByText(/1 game imported/i)).toBeInTheDocument();
    });
    // The outcome card reads Dexie for the next batch size; waiting for the button
    // it produces settles that update inside act() rather than after the test.
    await screen.findByRole('button', { name: /import 50 more/i });
  });

  test('unreadable text is refused in plain words and no game is stored', async () => {
    at(<ImportScreen />);
    await userEvent.click(screen.getByLabelText(/your games, in pgn/i));
    await userEvent.paste('my shopping list: eggs, milk');
    await userEvent.click(screen.getByRole('button', { name: /import these games/i }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not read any games/i);
    expect(await db.imported.count()).toBe(0);
  });

  test('re-pasting the same game adds nothing and says the games were already held', async () => {
    await storeImported([
      {
        gameId: 'pgn-placeholder',
        source: 'pgn',
        learner: 'w',
        opponent: 'Rosa',
        result: 'win',
        speed: 'rapid',
        playedAt: '2026-09-20T14:00:00Z',
        sans: ['e4'],
        pgn: 'x',
        learnerElo: null,
        opponentElo: null,
      },
    ]);
    at(<ImportScreen />);
    await userEvent.click(screen.getByLabelText(/your games, in pgn/i));
    await userEvent.paste(PGN);
    await userEvent.click(screen.getByRole('button', { name: /import these games/i }));
    await waitFor(() => {
      expect(screen.getByText(/1 game imported/i)).toBeInTheDocument();
    });
    // The outcome card reads Dexie for the next batch size; waiting for the button
    // it produces settles that update inside act() rather than after the test.
    await screen.findByRole('button', { name: /import 50 more/i });
    // Now the same paste again.
    await userEvent.click(screen.getByLabelText(/your games, in pgn/i));
    await userEvent.paste(PGN);
    await userEvent.click(screen.getByRole('button', { name: /import these games/i }));
    await waitFor(() => {
      expect(screen.getByText(/already had those games/i)).toBeInTheDocument();
    });
    await screen.findByRole('button', { name: /import 50 more/i });
  });

  test('an import in which every game is refused does not claim we already had them', async () => {
    // Found by walking this path in the browser: a paste whose only game does not
    // replay adds nothing AND holds nothing, and the "already had those games"
    // sentence contradicted the skip reason printed right below it.
    at(<ImportScreen />);
    await userEvent.click(screen.getByLabelText(/your games, in pgn/i));
    // Legal until 10...Nd5, where the knight is already on d5.
    await userEvent.paste(
      '[White "learner_one"]\n[Black "Rosa"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 6. Nxf7 Kxf7 7. Qf3+ Ke6 8. Nc3 Ncb4 9. a3 Nxc3 10. bxc3 Nd5 1-0',
    );
    await userEvent.click(screen.getByRole('button', { name: /import these games/i }));
    await waitFor(() => {
      expect(screen.getByText(/no games were imported/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/did not add up to a legal game/i)).toBeInTheDocument();
    expect(screen.queryByText(/already had those games/i)).toBeNull();
    expect(await db.imported.count()).toBe(0);
  });

  test('an import appends a games_imported event so the log records it', async () => {
    at(<ImportScreen />);
    await userEvent.click(screen.getByLabelText(/your games, in pgn/i));
    await userEvent.paste(PGN);
    await userEvent.click(screen.getByRole('button', { name: /import these games/i }));
    await waitFor(() => {
      expect(screen.getByText(/1 game imported/i)).toBeInTheDocument();
    });
    // The outcome card reads Dexie for the next batch size; waiting for the button
    // it produces settles that update inside act() rather than after the test.
    await screen.findByRole('button', { name: /import 50 more/i });
    const events = await db.events.toArray();
    const imported = events.filter((e) => e.payload.type === 'games_imported');
    expect(imported).toHaveLength(1);
    expect(imported[0]!.payload).toMatchObject({ type: 'games_imported', source: 'pgn', username: null, added: 1 });
  });
});

describe('ImportScreen switches', () => {
  test('F-IM-2 bullet switch is off by default and turning it on persists', async () => {
    at(<ImportScreen />);
    const toggle = screen.getByRole('checkbox', { name: /include bullet games in my profile/i });
    expect(toggle).not.toBeChecked();
    await userEvent.click(toggle);
    expect(useImportSettings.getState().includeBullet).toBe(true);
  });

  test('F-IM-4 keep-current switch is on by default and can be turned off', async () => {
    at(<ImportScreen />);
    const toggle = screen.getByRole('checkbox', { name: /keep my games up to date/i });
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    expect(useImportSettings.getState().keepCurrent).toBe(false);
  });

  test('each switch appends a settings_changed event, as the house pattern does', async () => {
    at(<ImportScreen />);
    await userEvent.click(screen.getByRole('checkbox', { name: /include bullet games/i }));
    await waitFor(async () => {
      const keys = (await db.events.toArray())
        .map((e) => (e.payload.type === 'settings_changed' ? e.payload.key : null))
        .filter(Boolean);
      expect(keys).toContain('importIncludeBullet');
    });
  });
});

describe('ReviewListScreen, F-IM-6', () => {
  function game(over: Partial<ImportedGame> = {}): ImportedGame {
    return {
      gameId: 'cc-1',
      source: 'chess.com',
      learner: 'w',
      opponent: 'Rosa',
      result: 'win',
      speed: 'rapid',
      playedAt: '2026-09-20T14:00:00Z',
      sans: ['e4', 'e5'],
      pgn: 'x',
      learnerElo: 800,
      opponentElo: 810,
      ...over,
    };
  }

  test('an empty list offers the import screen rather than showing nothing', async () => {
    at(<ReviewListScreen />);
    expect(await screen.findByText(/no imported games yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /import your games/i })).toHaveAttribute('href', '/import');
  });

  test('each game is listed with its source, opponent and result', async () => {
    await storeImported([
      game(),
      game({ gameId: 'li-2', source: 'lichess', opponent: 'Bruno', result: 'loss', speed: 'blitz', playedAt: '2026-09-21T00:00:00Z' }),
    ]);
    at(<ReviewListScreen />);
    // F-IM-6 names exactly these three things.
    expect(await screen.findByText(/won against rosa/i)).toBeInTheDocument();
    expect(screen.getByText(/lost against bruno/i)).toBeInTheDocument();
    expect(screen.getByText(/chess\.com/i)).toBeInTheDocument();
    expect(screen.getByText(/lichess/i)).toBeInTheDocument();
  });

  test('every row links to the ordinary review route, not to a separate screen', async () => {
    await storeImported([game()]);
    at(<ReviewListScreen />);
    const link = await screen.findByRole('link', { name: /won against rosa/i });
    expect(link).toHaveAttribute('href', '/play/review/cc-1');
  });

  test('the newest game is listed first', async () => {
    await storeImported([
      game({ gameId: 'old', playedAt: '2026-01-01T00:00:00Z', opponent: 'Older' }),
      game({ gameId: 'new', playedAt: '2026-09-30T00:00:00Z', opponent: 'Newer' }),
    ]);
    at(<ReviewListScreen />);
    const links = await screen.findAllByRole('link');
    expect(links[0]).toHaveTextContent(/Newer/);
    expect(links[1]).toHaveTextContent(/Older/);
  });

  test('the profile states how many games it rests on, counting only analysed ones', async () => {
    await storeImported([game(), game({ gameId: 'cc-2', playedAt: '2026-09-19T00:00:00Z' })]);
    await db.imported.update('cc-1', { analysis: 'done' });
    at(<ReviewListScreen />);
    // F-IM-3: "shows how many games it is based on". Two imported, one analysed.
    expect(await screen.findByText(/rests on 1 analysed game/i)).toBeInTheDocument();
    expect(screen.getByText(/1 still to analyse/i)).toBeInTheDocument();
  });

  test('a game still waiting says so rather than looking reviewed', async () => {
    await storeImported([game()]);
    at(<ReviewListScreen />);
    expect(await screen.findByText(/waiting to be analysed/i)).toBeInTheDocument();
  });

  test('a game whose date is unknown says so rather than showing 1970', async () => {
    await storeImported([game({ playedAt: '1970-01-01T00:00:00Z' })]);
    at(<ReviewListScreen />);
    expect(await screen.findByText(/date unknown/i)).toBeInTheDocument();
  });
});

describe('an imported game opens the ordinary review, at the ordinary route', () => {
  /*
   * Mutation testing found this gap. The PGN-paste test asserted that a review
   * ROW existed in Dexie, but that row is written by the analysis queue — so
   * deleting ReviewScreen's `importedSource` fallback left every test green while
   * the learner got "We could not find that game to review". F-IM-6's whole claim
   * is that the imported game reaches the SAME review, so the claim has to be
   * tested at the screen, not at the table.
   */
  async function seed() {
    await storeImported([
      {
        gameId: 'cc-777',
        source: 'chess.com',
        learner: 'w',
        opponent: 'Rosa',
        result: 'win',
        speed: 'rapid',
        playedAt: '2026-09-20T14:00:00Z',
        sans: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
        pgn: 'x',
        learnerElo: 800,
        opponentElo: 810,
      },
    ]);
  }

  test('the review screen resolves an imported game that has no events at all', async () => {
    await seed();
    // There is no `game_started` event for this game: the event log is empty.
    expect(await db.events.count()).toBe(0);
    render(
      <MemoryRouter initialEntries={['/play/review/cc-777']}>
        <Routes>
          <Route path="/play/review/:gameId" element={<ReviewScreen />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /game review/i })).toBeInTheDocument();
    });
    expect(screen.queryByText(/could not find that game/i)).toBeNull();
  });

  test('a game that is neither played nor imported is still reported as missing', async () => {
    // The positive control for the assertion above: the "missing" branch is real
    // and reachable, so its absence there is the import fallback working.
    render(
      <MemoryRouter initialEntries={['/play/review/nothing-here']}>
        <Routes>
          <Route path="/play/review/:gameId" element={<ReviewScreen />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/could not find that game/i)).toBeInTheDocument();
  });
});
