import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * PRD F-ER-1, the load-bearing half:
 *
 * > "If the engine fails to load or runs out of memory, LESSONS AND PUZZLES
 * > CONTINUE TO WORK FROM THEIR STORED SOLUTIONS, bot play and review show a
 * > one-line explanation with a retry..."
 *
 * The retry half is a message and is tested where the message is rendered
 * (play/PlayScreen, review/ReviewScreen, lesson/challenges/PlayItOut). This
 * file tests the half that is NOT a message: that a learner whose engine is
 * gone can still do a lesson and still do a puzzle. That is the clause the app
 * would fail silently — nothing renders an error, the learner simply finds a
 * board that will not grade anything — so nothing about it is visible in a
 * screenshot of a healthy build.
 *
 * TWO INSTRUMENTS, BECAUSE ONE WOULD BE ENOUGH TO FOOL.
 *
 *  1. A STRUCTURAL one: walk the real import graph from each entry point and
 *     ask whether `@/engine` is reachable at all. A behavioural test alone
 *     proves only that the ONE path it drove did not need the engine; a graph
 *     walk covers the paths no test drove. It is also the instrument that
 *     survives refactoring: an engine import added three modules deep inside
 *     the puzzle grader is invisible to any rendered test that does not happen
 *     to reach that branch.
 *
 *  2. A BEHAVIOURAL one: mount the real puzzle player and the real lesson
 *     grader with `@/engine` replaced by a module that throws on every access,
 *     and solve something. The graph walk proves the engine is not imported;
 *     this proves the feature actually works, which is a different claim —
 *     `import`-free code can still be broken code.
 *
 * WHY THE GRAPH WALK IS NOT SCOPED TO A DIRECTORY. `src/puzzles/` also holds
 * features that are not the solving path, and another change in flight is adding
 * one. A directory-wide "nothing here imports the engine" assertion would go red
 * on a sibling feature's legitimate engine use and say nothing about this clause.
 * The walk therefore starts from the ENTRY POINTS the requirement names — the
 * thing that plays a puzzle, and the thing that grades a lesson attempt — and
 * follows only what they actually reach.
 */

const SRC = resolve(__dirname, '..');

/** Resolve one import specifier to a file on disk, or null when it is a package. */
function resolveImport(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = resolve(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  // A bare specifier is a node_modules package: react, chess.js, zustand. Not
  // our graph, and none of them can reach src/engine.
  else return null;

  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    resolve(base, 'index.ts'),
    resolve(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate) && !candidate.endsWith('/')) {
      try {
        // A directory `existsSync`es too; readFileSync on one throws EISDIR.
        readFileSync(candidate, 'utf8');
        return candidate;
      } catch {
        continue;
      }
    }
  }
  return null;
}

/**
 * Every `from '...'` specifier in a module. Deliberately a regex over source
 * rather than a parser: this matches static imports, `export ... from`, and
 * type-only imports, which is exactly the set that can drag `src/engine` into a
 * bundle. A `await import()` would be missed, so the assertion below also checks
 * for that form by name.
 */
function specifiersOf(source: string): string[] {
  return [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1] ?? '');
}

/** Every file reachable from `entry` by static import, `entry` included. */
function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const stack = [resolve(SRC, entry)];
  while (stack.length > 0) {
    const file = stack.pop();
    if (file === undefined || seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    // A dynamic import of the engine would be an engine dependency the `from`
    // regex cannot see. Fail loudly rather than reporting a clean graph.
    expect(source, `${file} reaches the engine through a dynamic import`).not.toMatch(
      /import\(\s*['"][^'"]*\/engine['"]\s*\)/,
    );
    for (const spec of specifiersOf(source)) {
      const target = resolveImport(file, spec);
      if (target !== null) stack.push(target);
    }
  }
  return seen;
}

/** Which reachable files live in `src/engine/`. */
function engineFilesIn(graph: Set<string>): string[] {
  const engineDir = resolve(SRC, 'engine');
  return [...graph].filter((f) => f.startsWith(`${engineDir}/`)).map((f) => f.slice(SRC.length + 1)).sort();
}

describe('F-ER-1: the engine is not on the lesson or puzzle solving path', () => {
  /**
   * THE POSITIVE CONTROL, and it comes first deliberately.
   *
   * Every assertion below is an ABSENCE — "the engine is not reachable" — and an
   * absence is what a broken walker reports too. A resolver that silently
   * returned null for every specifier would produce a one-file graph and a clean
   * bill of health for the whole app. So the walk is first pointed at two entry
   * points that certainly DO depend on the engine, and required to find it.
   */
  test('the walker finds the engine where the engine really is', () => {
    const play = engineFilesIn(reachableFrom('play/useGame.ts'));
    const review = engineFilesIn(reachableFrom('review/AnalysisService.ts'));
    expect(play).toContain('engine/EngineClient.ts');
    expect(review).toContain('engine/EngineClient.ts');
    // And the graph is a real graph, not one file: `useGame` reaches the engine
    // through `@/bot`, which is two hops, so a walker that only read the entry
    // file would fail here.
    expect(reachableFrom('play/useGame.ts').size).toBeGreaterThan(10);
  });

  test('playing a puzzle cannot reach the engine', () => {
    // `PuzzleRoutes.tsx` is the whole feature as it is mounted: route data, the
    // pack loader, the queue, the rating, the player.
    const graph = reachableFrom('puzzles/PuzzleRoutes.tsx');
    // The absence below is only worth reading if the walk went somewhere. These
    // two lines are this test's own positive control: a resolver that returned
    // null for everything would satisfy `toEqual([])` and fail these.
    expect(graph.size).toBeGreaterThan(15);
    expect([...graph].map((f) => f.slice(SRC.length + 1))).toEqual(
      expect.arrayContaining(['puzzles/session.ts', 'puzzles/packs.ts', 'puzzles/PuzzlePlayer.tsx']),
    );
    expect(engineFilesIn(graph)).toEqual([]);
  });

  test('grading a lesson attempt cannot reach the engine', () => {
    // The grader and the state machine. `challenges/PlayItOut.tsx` is
    // deliberately NOT an entry point here: a "play it out" drill is a game
    // against an opponent, so the engine IS its stored solution and F-ER-1's
    // remedy for it is the one-line-plus-retry that PlayItOut.test.tsx covers.
    const graders = reachableFrom('lesson/answers.ts');
    const machine = reachableFrom('lesson/LessonMachine.ts');
    // Same control as above: these walks must have traversed something.
    expect([...graders].map((f) => f.slice(SRC.length + 1))).toContain('rules/index.ts');
    expect(machine.size).toBeGreaterThan(3);
    expect(engineFilesIn(graders)).toEqual([]);
    expect(engineFilesIn(machine)).toEqual([]);
  });
});

/*
 * The behavioural half. `@/engine` is replaced by a module whose every export
 * throws, so any call — including one added later — fails loudly rather than
 * being quietly absent.
 */
vi.mock('@/engine', () => ({
  getEngine: () => {
    throw new Error('EngineUnavailable: engine absent (F-ER-1)');
  },
  createBrowserEngine: () => {
    throw new Error('EngineUnavailable: engine absent (F-ER-1)');
  },
  EngineUnavailable: class extends Error {},
  scoreToWinPercent: () => {
    throw new Error('EngineUnavailable: engine absent (F-ER-1)');
  },
}));

// The shared board, stubbed as PuzzlePlayer.test.tsx and LessonPlayer.board.test.tsx
// stub it: react-chessboard measures a square, and jsdom has no layout.
vi.mock('@/board', () => ({
  Board: ({
    fen,
    disabled,
    textEntry,
    onMove,
  }: {
    fen: string;
    disabled?: boolean;
    textEntry?: boolean;
    onMove?: (m: { from: string; to: string; uci: string; san: string }) => void;
  }) => (
    <div>
      <span data-testid="fen">{fen}</span>
      {textEntry === true && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const field = e.currentTarget.elements.namedItem('m') as HTMLInputElement;
            const uci = field.value.trim();
            field.value = '';
            if (disabled !== true && uci) onMove?.({ from: uci.slice(0, 2), to: uci.slice(2, 4), uci, san: uci });
          }}
        >
          <input name="m" aria-label="Type a move" />
          <button type="submit">Move</button>
        </form>
      )}
    </div>
  ),
}));

describe('F-ER-1: a learner with no engine can still solve', () => {
  test('a puzzle is solved from its stored solution', async () => {
    const { PuzzlePlayer } = await import('@/puzzles/PuzzlePlayer');
    const onDone = vi.fn();
    render(
      <PuzzlePlayer
        puzzle={{
          id: 'p1',
          rating: 1000,
          themes: ['fork'],
          fen: '8/8/8/8/8/8/8/K6k w - - 0 1',
          // solution[0] is the opponent's move; the learner plays solution[1].
          solution: ['a1a2', 'h1h2'],
        }}
        source="rated"
        onDone={onDone}
        onExit={vi.fn()}
        textEntry
      />,
    );

    const field = await screen.findByLabelText('Type a move');
    await userEvent.type(field, 'h1h2{enter}');

    // The observable the LEARNER gets: the puzzle graded, and graded CORRECT.
    // Asserting only that nothing threw would pass for a player that silently
    // accepted every move.
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ puzzleId: 'p1', solved: true }));
  });

  test('a wrong move is still refused, so the grading is real and not a rubber stamp', async () => {
    const { PuzzlePlayer } = await import('@/puzzles/PuzzlePlayer');
    const onDone = vi.fn();
    render(
      <PuzzlePlayer
        puzzle={{
          id: 'p1',
          rating: 1000,
          themes: ['fork'],
          fen: '8/8/8/8/8/8/8/K6k w - - 0 1',
          solution: ['a1a2', 'h1h2'],
        }}
        source="rated"
        onDone={onDone}
        onExit={vi.fn()}
        textEntry
      />,
    );

    const field = await screen.findByLabelText('Type a move');
    await userEvent.type(field, 'h1g2{enter}');
    // A miss, not a solve. Without this the test above would pass against a
    // player that had stopped grading altogether — the exact failure F-ER-1
    // is about.
    expect(onDone).not.toHaveBeenCalledWith(expect.objectContaining({ solved: true }));
  });

  test('a lesson attempt is graded from the authored answer', async () => {
    const { checkAnswer } = await import('@/lesson/answers');
    const challenge = {
      type: 'find_the_move' as const,
      id: 'c1',
      concept: 'mate',
      fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1',
      answer: { moves: ['Qxf7#'] },
      prompt: 'Mate in one.',
    };
    // Right answer and wrong answer, through the same code, with no engine. The
    // wrong one matters as much: a grader that had stopped grading would return
    // `correct` for both, and only the second line can tell.
    expect(checkAnswer(challenge, { kind: 'move', uci: 'f3f7' }).correct).toBe(true);
    expect(checkAnswer(challenge, { kind: 'move', uci: 'c4f7' }).correct).toBe(false);
  });
});
