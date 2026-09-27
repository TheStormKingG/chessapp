import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { DrillRoute } from './DrillRoute';
import { DRILLS, drillKey } from './drills';
import { starsFor, usePractice } from './results';

/**
 * `PlayItOut` is stubbed, and that is the right boundary rather than a shortcut.
 *
 * It is the existing runner: it owns the board, the engine gate, the opponent's
 * replies and `goal.ts`, and it has its own test file covering all of that. What
 * THIS route owns is the three things around it — load the lesson the drill lives
 * in, hand over the challenge, and turn `onResult(met)` into a star rating. Driving
 * the real runner would test the engine again and say nothing about any of them.
 *
 * The stub exposes the one thing the route consumes, `onResult`, as two buttons.
 */
const runner = vi.hoisted(() => ({
  /** The props of the LATEST render, for the tests that assert on current props. */
  renders: [] as { disabled: boolean; highlights: string[] }[],
  /** Incremented once per MOUNT, never per render. See the note below. */
  instances: 0,
  /** The `c` each render was given, so identity churn is observable. */
  identities: [] as unknown[],
}));
vi.mock('@/lesson/challenges/PlayItOut', () => ({
  PlayItOut: ({
    c,
    onResult,
    disabled,
    highlights,
  }: {
    c: { id: string; fen: string };
    onResult: (met: boolean) => void;
    disabled?: boolean;
    highlights?: Record<string, string>;
  }) => {
    runner.renders.push({ disabled: disabled ?? false, highlights: Object.keys(highlights ?? {}) });
    /*
     * The identity of `c`, recorded per render.
     *
     * The real `PlayItOut` resets its position, its move count and its settled
     * flag whenever `props.c` changes identity — that is the documented seam a
     * retry uses. A stub that ignores `c`'s identity cannot witness the drill
     * being reset, and one did not: the route passed a fresh `{ ...challenge }`
     * spread on every render, so every re-render silently restarted the drill,
     * fifteen tests passed, and the defect was found by playing a drill in a
     * browser and watching the board jump back to the start.
     */
    runner.identities.push(c);
    /*
     * A per-INSTANCE id, from a `useState` initialiser — which React runs once per
     * mount and never on a re-render.
     *
     * The first version of this stub counted renders and the test asserted that
     * the count grew on a retry. That passed with the route's `key={attempt}`
     * replaced by a constant, because a re-render bumps a render counter just as a
     * remount does. The route's whole contract with `PlayItOut` is that a retry
     * gives it a NEW INSTANCE — that is what makes it reset its position, since it
     * compares `props.c` by identity — so the probe has to be able to tell the two
     * apart, and a render counter cannot.
     */
    const [instance] = useState(() => ++runner.instances);
    return (
      <div>
        <span data-testid="runner-instance">{instance}</span>
        <span data-testid="runner-challenge">{c.id}</span>
        <span data-testid="runner-fen">{c.fen}</span>
        <button type="button" disabled={disabled} onClick={() => onResult(true)}>
          win
        </button>
        <button type="button" disabled={disabled} onClick={() => onResult(false)}>
          lose
        </button>
      </div>
    );
  },
}));

/** A drill that really exists, with a hint and a reason in its content. */
const DRILL = DRILLS.find((d) => d.lessonId === '1.5.3')!;

function show(lessonId: string, challengeId: string) {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[`/practice/drill/${lessonId}/${challengeId}`]}>
      <Routes>
        <Route path="/practice/drill/:lessonId/:challengeId" element={<DrillRoute />} />
      </Routes>
    </MemoryRouter>,
  );
  return user;
}

/** The lesson is a real dynamic import of a content file, which is not instant. */
async function ready() {
  await waitFor(
    () => {
      expect(screen.getByTestId('runner-challenge')).toBeInTheDocument();
    },
    // An explicit timeout: this awaits a REAL dynamic import of a content chunk,
    // and waitFor's default 1000 ms is not enough for one under load.
    { timeout: 15_000 },
  );
}

describe('running one drill', () => {
  beforeEach(() => {
    usePractice.getState().reset();
    runner.renders.length = 0;
    runner.instances = 0;
    runner.identities.length = 0;
  });

  it('loads the challenge the route names and hands it to the existing runner', async () => {
    show(DRILL.lessonId, DRILL.challengeId);
    await ready();
    expect(screen.getByTestId('runner-challenge')).toHaveTextContent(DRILL.challengeId);
    // A real FEN from content, not an invented one.
    expect(screen.getByTestId('runner-fen').textContent).toMatch(/^[1-8rnbqkpRNBQKP/]+ [wb] /);
  });

  it('shows the goal and the par F-PR-1 asks for', async () => {
    show(DRILL.lessonId, DRILL.challengeId);
    await ready();
    expect(screen.getByTestId('drill-goal')).toHaveTextContent('Deliver checkmate');
    expect(screen.getByTestId('drill-goal')).toHaveTextContent(`Within ${String(DRILL.par)} moves`);
  });

  it("shows the content's own prompt", async () => {
    show(DRILL.lessonId, DRILL.challengeId);
    await ready();
    expect(screen.getByTestId('drill-prompt').textContent?.length ?? 0).toBeGreaterThan(10);
  });

  it('banks three stars for a clean win', async () => {
    const user = show(DRILL.lessonId, DRILL.challengeId);
    await ready();
    await user.click(screen.getByRole('button', { name: 'win' }));
    await waitFor(() => {
      expect(screen.getByTestId('drill-outcome')).toHaveTextContent('Goal reached.');
    });
    expect(starsFor(usePractice.getState().results, drillKey(DRILL))).toBe(3);
  });

  it('banks no stars for a loss, and shows the reason from content', async () => {
    const user = show(DRILL.lessonId, DRILL.challengeId);
    await ready();
    await user.click(screen.getByRole('button', { name: 'lose' }));
    await waitFor(() => {
      expect(screen.getByTestId('drill-outcome')).toHaveTextContent('Not this time.');
    });
    expect(starsFor(usePractice.getState().results, drillKey(DRILL))).toBe(0);
    expect(screen.getByTestId('drill-reason').textContent?.length ?? 0).toBeGreaterThan(10);
  });

  it('charges a miss to the next attempt, so a retried drill scores two', async () => {
    const user = show(DRILL.lessonId, DRILL.challengeId);
    await ready();
    await user.click(screen.getByRole('button', { name: 'lose' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await user.click(screen.getByRole('button', { name: 'win' }));
    await waitFor(() => {
      expect(screen.getByTestId('drill-outcome')).toHaveTextContent('Goal reached.');
    });
    // stars({ hints: 0, misses: 1 }) is 3 — src/lesson/stars.ts allows one miss in
    // a clean run. The point of this test is that the miss is COUNTED and reaches
    // the scorer, which the next test then shows changing the rating.
    expect(usePractice.getState().results[drillKey(DRILL)]?.attempts).toBe(2);
    expect(starsFor(usePractice.getState().results, drillKey(DRILL))).toBe(3);
  });

  it('drops to two stars after two misses', async () => {
    const user = show(DRILL.lessonId, DRILL.challengeId);
    await ready();
    for (let i = 0; i < 2; i++) {
      await user.click(screen.getByRole('button', { name: 'lose' }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: 'Try again' }));
    }
    await user.click(screen.getByRole('button', { name: 'win' }));
    await waitFor(() => {
      expect(screen.getByTestId('drill-outcome')).toHaveTextContent('Goal reached.');
    });
    expect(starsFor(usePractice.getState().results, drillKey(DRILL))).toBe(2);
  });

  it('costs a star for using the hint, exactly as a lesson does', async () => {
    const user = show(DRILL.lessonId, DRILL.challengeId);
    await ready();
    await user.click(screen.getByRole('button', { name: /first move/i }));
    await user.click(screen.getByRole('button', { name: 'win' }));
    await waitFor(() => {
      expect(screen.getByTestId('drill-outcome')).toBeInTheDocument();
    });
    expect(starsFor(usePractice.getState().results, drillKey(DRILL))).toBe(2);
  });

  it('marks BOTH first-move squares on the board once the hint is taken', async () => {
    const user = show(DRILL.lessonId, DRILL.challengeId);
    await ready();
    // Before: no highlight. The absence assertion...
    expect(runner.renders.at(-1)?.highlights).toEqual([]);
    await user.click(screen.getByRole('button', { name: /first move/i }));
    // ...and its positive control: the same probe finds one afterwards.
    await waitFor(() => {
      expect(runner.renders.at(-1)?.highlights.length).toBeGreaterThan(0);
    });
    // The hint is the first MOVE, so both its from- and to-square are marked.
    // 1.5.3 carries a `piece` and a `square`, which is why it is the fixture.
    expect(runner.renders.at(-1)?.highlights).toHaveLength(2);
  });

  it('names the hint as the first move, not as generic help', async () => {
    // The squares are true of the starting position only, so the control has to
    // say which move it is about — a learner asking on move six is otherwise
    // shown a ring on a square their piece left five moves ago.
    show(DRILL.lessonId, DRILL.challengeId);
    await ready();
    expect(screen.getByRole('button', { name: /first move/i })).toBeInTheDocument();
  });

  it('always says something when the hint is taken, even with no text in content', async () => {
    // 19 of 28 drills carry squares and only 9 carry text, so a hint that
    // rendered only `hints.text` would silently show nothing for most drills.
    const user = show(DRILL.lessonId, DRILL.challengeId);
    await ready();
    await user.click(screen.getByRole('button', { name: /first move/i }));
    expect(screen.getByTestId('drill-hint').textContent?.length ?? 0).toBeGreaterThan(10);
  });

  it('offers the hint once, not repeatedly', async () => {
    const user = show(DRILL.lessonId, DRILL.challengeId);
    await ready();
    expect(screen.getByRole('button', { name: /first move/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /first move/i }));
    expect(screen.queryByRole('button', { name: /first move/i })).toBeNull();
  });

  it('disables the runner once the drill has settled', async () => {
    const user = show(DRILL.lessonId, DRILL.challengeId);
    await ready();
    expect(runner.renders.at(-1)?.disabled).toBe(false);
    await user.click(screen.getByRole('button', { name: 'win' }));
    await waitFor(() => {
      expect(runner.renders.at(-1)?.disabled).toBe(true);
    });
  });

  it('hands the runner a STABLE challenge object across re-renders', async () => {
    /*
     * The regression test for a defect found in the browser, not in this file.
     *
     * `PlayItOut` restarts the drill whenever `props.c` changes identity. The
     * route used to build that prop with a `{ ...challenge }` spread, so every
     * re-render was a new object and every re-render restarted the drill: taking
     * a hint put the board back to the starting position with the move count at
     * zero. Nothing here caught it, because the stub ignored `c`.
     *
     * Taking the hint is the cheapest re-render the route has that is not also a
     * remount, which is what makes it the right trigger to assert against.
     */
    const user = show(DRILL.lessonId, DRILL.challengeId);
    await ready();
    const before = runner.identities.at(-1);
    const renderedBefore = runner.renders.length;

    await user.click(screen.getByRole('button', { name: /first move/i }));
    await waitFor(() => {
      // The positive control: the hint DID cause a re-render, so the identity
      // check below is looking at something rather than at an unchanged tree.
      expect(runner.renders.length).toBeGreaterThan(renderedBefore);
    });
    expect(runner.identities.at(-1)).toBe(before);
    // And no remount either — a remount would reset the drill just as surely.
    expect(screen.getByTestId('runner-instance').textContent).toBe('1');
  });

  it('keeps the challenge stable when the drill settles', async () => {
    const user = show(DRILL.lessonId, DRILL.challengeId);
    await ready();
    const before = runner.identities.at(-1);
    await user.click(screen.getByRole('button', { name: 'lose' }));
    await waitFor(() => {
      expect(screen.getByTestId('drill-outcome')).toBeInTheDocument();
    });
    expect(runner.identities.at(-1)).toBe(before);
  });

  it('restarts the position on a retry by remounting, not by re-rendering', async () => {
    const user = show(DRILL.lessonId, DRILL.challengeId);
    await ready();
    const first = screen.getByTestId('runner-instance').textContent;

    await user.click(screen.getByRole('button', { name: 'lose' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });
    // The control for the assertion below: settling the drill RE-RENDERS the
    // runner (it becomes disabled) without remounting it, so the instance id must
    // still be the same here. That is what makes the change after the retry mean
    // "remounted" rather than merely "rendered again".
    expect(screen.getByTestId('runner-instance').textContent).toBe(first);

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.getByTestId('runner-instance').textContent).not.toBe(first);
    });
    expect(runner.renders.at(-1)?.disabled).toBe(false);
  });

  it('links back to the drill list', async () => {
    const user = show(DRILL.lessonId, DRILL.challengeId);
    await ready();
    await user.click(screen.getByRole('button', { name: 'win' }));
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Back to drills/ })).toHaveAttribute('href', '/practice/drills');
    });
  });
});

describe('a drill the catalogue does not have', () => {
  it('says so instead of rendering a blank board', () => {
    show('9.9.9', 'not-a-drill');
    expect(screen.getByRole('heading', { name: /not found/i })).toBeInTheDocument();
    // The absence assertion, with its control: the runner is not mounted, and the
    // way back is.
    expect(screen.queryByTestId('runner-challenge')).toBeNull();
    expect(screen.getByRole('link', { name: /Back to drills/ })).toBeInTheDocument();
  });

  it('rejects a real lesson paired with another lesson’s challenge', () => {
    const other = DRILLS.find((d) => d.lessonId !== DRILL.lessonId)!;
    show(DRILL.lessonId, other.challengeId);
    expect(screen.getByRole('heading', { name: /not found/i })).toBeInTheDocument();
  });
});
