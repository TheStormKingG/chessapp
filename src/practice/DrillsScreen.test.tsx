import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { DrillsScreen } from './DrillsScreen';
import { CATEGORY_TITLE, DRILLS, DRILL_CATEGORIES, GOAL_LABEL, drillKey, drillsIn, parLabel } from './drills';
import { usePractice } from './results';

function show() {
  render(
    <MemoryRouter>
      <DrillsScreen />
    </MemoryRouter>,
  );
}

describe('the drill list (F-PR-1)', () => {
  beforeEach(() => {
    usePractice.getState().reset();
  });

  it('lists every drill in the catalogue', () => {
    show();
    for (const drill of DRILLS) {
      expect(screen.getByTestId(`drill-${drillKey(drill)}`), drillKey(drill)).toBeInTheDocument();
    }
    expect(screen.getAllByRole('link')).toHaveLength(DRILLS.length);
  });

  it('groups them under all four categories', () => {
    show();
    for (const category of DRILL_CATEGORIES) {
      expect(
        screen.getByRole('heading', { name: CATEGORY_TITLE[category] }),
        CATEGORY_TITLE[category],
      ).toBeInTheDocument();
    }
  });

  it('shows the goal and the par on every card', () => {
    show();
    for (const drill of DRILLS) {
      const card = screen.getByTestId(`drill-${drillKey(drill)}`);
      expect(card, drillKey(drill)).toHaveTextContent(GOAL_LABEL[drill.goal]);
      expect(card, drillKey(drill)).toHaveTextContent(parLabel(drill));
    }
  });

  it('links each card at the drill route that runs it', () => {
    show();
    const drill = DRILLS[0]!;
    expect(screen.getByTestId(`drill-${drillKey(drill)}`)).toHaveAttribute(
      'href',
      `/practice/drill/${drill.lessonId}/${drill.challengeId}`,
    );
  });

  it('distinguishes the two drills of lesson 1.5.1', () => {
    show();
    const both = DRILLS.filter((d) => d.lessonId === '1.5.1');
    expect(both).toHaveLength(2);
    const hrefs = both.map((d) => screen.getByTestId(`drill-${drillKey(d)}`).getAttribute('href'));
    expect(new Set(hrefs).size).toBe(2);
    // They share a title, so the pars are what tell them apart on screen.
    expect(screen.getByTestId(`drill-${drillKey(both[0]!)}`)).toHaveTextContent(parLabel(both[0]!));
    expect(screen.getByTestId(`drill-${drillKey(both[1]!)}`)).toHaveTextContent(parLabel(both[1]!));
  });

  it('shows the sub-group headings where a category has more than one', () => {
    show();
    // Endgames has three groups, so its headings must be on the page.
    expect(screen.getByRole('heading', { name: 'Rook endings' })).toBeInTheDocument();
    // Mini-games has one group, whose heading would repeat its category — so it
    // is suppressed. The absence assertion...
    expect(screen.queryByRole('heading', { name: 'Section 1' })).toBeNull();
    // ...with the control proving the query finds a heading when there is one.
    expect(screen.getByRole('heading', { name: CATEGORY_TITLE['mini-games'] })).toBeInTheDocument();
  });
});

describe('stars (F-PR-1)', () => {
  beforeEach(() => {
    usePractice.getState().reset();
  });

  it('says "Not completed" before the drill has ever been finished', () => {
    show();
    const card = screen.getByTestId(`drill-${drillKey(DRILLS[0]!)}`);
    expect(within(card).getByTestId('stars')).toHaveTextContent('Not completed');
  });

  it('shows filled and empty stars once completed, with the count in text too', () => {
    const drill = DRILLS[0]!;
    usePractice.getState().record(drillKey(drill), { met: true, hints: 1, misses: 0 });
    show();
    const stars = within(screen.getByTestId(`drill-${drillKey(drill)}`)).getByTestId('stars');
    // F-AX-2: the glyph is never the sole carrier, so the number is readable too.
    expect(stars).toHaveTextContent('2 of 3 stars');
    expect(stars.textContent).toContain('★★☆');
  });

  it('shows three stars for a clean run', () => {
    const drill = DRILLS[0]!;
    usePractice.getState().record(drillKey(drill), { met: true, hints: 0, misses: 0 });
    show();
    const stars = within(screen.getByTestId(`drill-${drillKey(drill)}`)).getByTestId('stars');
    expect(stars).toHaveTextContent('3 of 3 stars');
    expect(stars.textContent).toContain('★★★');
  });

  it('leaves the other cards unstarred', () => {
    const [first, second] = [DRILLS[0]!, DRILLS[1]!];
    usePractice.getState().record(drillKey(first), { met: true, hints: 0, misses: 0 });
    show();
    expect(within(screen.getByTestId(`drill-${drillKey(second)}`)).getByTestId('stars')).toHaveTextContent(
      'Not completed',
    );
  });

  it('shows no stars for a drill attempted and failed', () => {
    const drill = DRILLS[0]!;
    usePractice.getState().record(drillKey(drill), { met: false, hints: 0, misses: 0 });
    show();
    expect(within(screen.getByTestId(`drill-${drillKey(drill)}`)).getByTestId('stars')).toHaveTextContent(
      'Not completed',
    );
  });
});

describe('the endgames category', () => {
  it('holds the pawn, rook and fundamental endings F-PR-1 names', () => {
    // F-PR-1's parenthesis is "(pawn, rook, minor piece)". The groups are named
    // after the curriculum units the drills come from, so this asserts the ones
    // that exist rather than the ones the sentence lists — the minor-piece
    // endings in unit 4.10 sit under the pawn-endings heading with the wrong
    // bishop, which is where the curriculum puts them.
    const groups = new Set(drillsIn('endgames').map((d) => d.group));
    expect(groups).toContain('Rook endings');
    expect(groups).toContain('Pawn endings and the wrong bishop');
    expect(groups).toContain('Fundamental endings');
  });
});
