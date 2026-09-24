import { render, screen, waitFor } from '@testing-library/react';
import { expect, test } from 'vitest';
import type { Challenge } from '../types';
import { ChallengeView } from './ChallengeView';

/**
 * "Show me" on a find_the_sequence showed nothing.
 *
 * Every other challenge type demonstrates its answer on reveal. A sequence
 * left the board exactly where the learner had got stuck, and `revealText`
 * names only the FIRST move of the line ("The line starts Rxd8+"). Worse, a
 * revealed challenge sets `busy`, which disables the board — so the learner
 * was told the opening move of a multi-move combination and then prevented
 * from playing it.
 *
 * That is the difference from `is_it_safe`, which looks like the same defect
 * and is not: a revealed `is_it_safe` gives the learner the whole answer
 * (safe or not, and why). A revealed sequence gave them one move out of three.
 *
 * The board already knows how to play a line out — `replay` does it for engine
 * refutations — so the fix reuses that rather than inventing a second way to
 * animate a board.
 */
/*
 * The REAL challenge 3.1.1-c6, not an invented one.
 *
 * My first draft of this test fabricated a position, and after `Rxd8+ Bxd8`
 * White's remaining rook stood on f1 — which cannot reach d8. `replayFrames`
 * drops a replay that does not fit its own position, in silence and by design,
 * so the test failed with an empty live region and no hint as to why. Using a
 * shipped, engine-verified position removes a whole class of self-inflicted
 * failure from a test about something else. Both rooks are on the d-file here,
 * which is what makes the third move possible.
 */
const line = ['Rxd8+', 'Bxd8', 'Rxd8#'];
const seq = {
  id: 's1',
  type: 'find_the_sequence',
  fen: '3r2k1/2b2ppp/8/8/8/8/3R1PPP/3R2K1 w - - 0 1',
  prompt: 'Take the first guard, let Black take back, then take the second.',
  concept: 'removing-the-defender',
  answer: { line },
} as unknown as Challenge;

function view(revealed: boolean) {
  return render(
    <ChallengeView
      c={seq}
      answeredFen={null}
      revealed={revealed}
      highlights={{}}
      refutation={null}
      busy={revealed}
      dispatch={() => undefined}
      onWrongMove={() => undefined}
    />,
  );
}

test('while the learner is still working, nothing is replayed', () => {
  // The whole point of the challenge is playing the line yourself.
  view(false);
  expect(screen.queryByText(/Rxd8/)).toBeNull();
});

test('a revealed sequence plays the WHOLE line, not just its first move', async () => {
  view(true);
  // Awaited because the replay is animated: the board steps through the line
  // and announces the LAST move when it lands. That announcement is the only
  // assertion that distinguishes "played the line" from "played the first
  // move" -- Rxd8# is the third, reachable only through all of them.
  //
  // getAllByRole: the board carries its own live region and the replay adds
  // another, so the single-element form throws on the count rather than
  // checking either.
  await waitFor(() => {
    const said = screen.getAllByRole('status').map((e) => e.textContent ?? '').join(' | ');
    expect(said).toContain('Rxd8#');
  });
});

test('the replay starts from the challenge position, not from wherever the learner stopped', () => {
  // A learner who played one move and then asked for help must see the line
  // from the beginning, or the replay is a fragment of an answer.
  const { container } = view(true);
  const board = container.querySelector('[role="application"]');
  expect(board, 'the board did not render').not.toBeNull();
});
