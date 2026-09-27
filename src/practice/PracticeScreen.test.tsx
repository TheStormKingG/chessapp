import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { PracticeScreen } from './PracticeScreen';
import { DRILLS } from './drills';

function show(props: { fixCount?: number; reviewCount?: number } = {}) {
  render(
    <MemoryRouter>
      <PracticeScreen {...props} />
    </MemoryRouter>,
  );
}

describe('the Practice tab (F-PR-1)', () => {
  it('offers the drills and the vision trainer', () => {
    show();
    expect(screen.getByRole('link', { name: /Drills/ })).toHaveAttribute('href', '/practice/drills');
    expect(screen.getByRole('link', { name: /Vision trainer/ })).toHaveAttribute('href', '/practice/vision');
  });

  it('says how many drills there are, from the catalogue rather than a literal', () => {
    show();
    expect(screen.getByRole('link', { name: /Drills/ })).toHaveTextContent(String(DRILLS.length));
  });

  it('names all four F-PR-1 drill categories on the entry', () => {
    show();
    const drills = screen.getByRole('link', { name: /Drills/ });
    for (const word of ['mates', 'motifs', 'endgames', 'mini-games']) {
      expect(drills).toHaveTextContent(word);
    }
  });

  it('still reaches the puzzles home, which is no longer a tab', () => {
    show();
    expect(screen.getByRole('link', { name: /Puzzles/ })).toHaveAttribute('href', '/puzzles');
  });
});

describe('F-PR-3: the review queue and fix-my-mistakes are reachable from Practice', () => {
  it('links to both when both have something in them', () => {
    show({ fixCount: 4, reviewCount: 2 });
    expect(screen.getByRole('link', { name: /Fix my mistakes/ })).toHaveAttribute('href', '/puzzles/fix');
    expect(screen.getByRole('link', { name: /Review queue/ })).toHaveAttribute('href', '/play/review');
  });

  it('puts the learner’s own mistakes above the generic entries', () => {
    show({ fixCount: 4, reviewCount: 2 });
    const links = screen.getAllByRole('link').map((a) => a.textContent ?? '');
    const fix = links.findIndex((t) => t.includes('Fix my mistakes'));
    const drills = links.findIndex((t) => t.includes('Drills'));
    expect(fix).toBeGreaterThanOrEqual(0);
    // An ordering requirement, not a presence one — the same call F-PZ-3 makes on
    // the puzzles home. An entry rendered last would satisfy "it is on the
    // screen" and none of what the requirement asks for.
    expect(fix).toBeLessThan(drills);
  });

  it('counts in words, singular and plural', () => {
    show({ fixCount: 1, reviewCount: 1 });
    expect(screen.getByRole('link', { name: /Fix my mistakes/ })).toHaveTextContent('1 mistake');
    expect(screen.getByRole('link', { name: /Review queue/ })).toHaveTextContent('1 game');
  });

  it('plural at more than one', () => {
    show({ fixCount: 3, reviewCount: 5 });
    expect(screen.getByRole('link', { name: /Fix my mistakes/ })).toHaveTextContent('3 mistakes');
    expect(screen.getByRole('link', { name: /Review queue/ })).toHaveTextContent('5 games');
  });

  it('says so rather than hiding the section when both are empty', () => {
    show({ fixCount: 0, reviewCount: 0 });
    // The absence assertion...
    expect(screen.queryByRole('link', { name: /Fix my mistakes/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Review queue/ })).toBeNull();
    // ...and the positive control proving the queries above would have found
    // something. Without it, a renamed entry would make the absence vacuous.
    expect(screen.getByTestId('nothing-waiting')).toHaveTextContent(/review queue/i);
    expect(screen.getByRole('link', { name: /Drills/ })).toBeInTheDocument();
  });

  it('shows the explanation only when there is nothing waiting', () => {
    show({ fixCount: 2, reviewCount: 0 });
    expect(screen.queryByTestId('nothing-waiting')).toBeNull();
  });
});

describe('the tab home stays cheap', () => {
  it('renders without a board, an engine or a lesson', () => {
    // The structural claim behind PracticeScreen's header note: this screen is on
    // the shell's first-paint graph, so it must render from the index alone. A
    // board would need react-chessboard and a measured square; this test passing
    // in jsdom with no such setup is the evidence.
    show({ fixCount: 1, reviewCount: 1 });
    expect(document.querySelector('[data-testid="board"]')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Practice' })).toBeInTheDocument();
  });
});
