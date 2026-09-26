import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { IMPORT_MIN_GAMES, destinationPath, levelDestination, onboardingStart } from './route';
import type { LearnerLevel } from './types';

/**
 * F-IM-5's hand-off, which src/onboarding/route.ts left open.
 *
 * The point of these tests is that the seam is WIRED, not merely present. The
 * import branch was previously unreachable because `levelDestination`'s game-count
 * parameter defaults to null and nothing passed one — a defaulted parameter with a
 * sensible fallback produces plausible behaviour and no error, so nothing would
 * have reported that the fourth route did not exist.
 */

/** Mocked so the decision can be tested without an engine or a network. */
const finished = vi.hoisted(() => ({ games: 0 }));
vi.mock('@/import', () => ({
  ImportScreen: ({ onFinished }: { onFinished?: (n: number) => void }) => (
    <button
      type="button"
      onClick={() => {
        onFinished?.(finished.games);
      }}
    >
      finish import
    </button>
  ),
}));

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname}</p>;
}

describe('onboardingStart', () => {
  test('a learner who plays online is sent to import, which is F-IM-5 fourth route', () => {
    expect(onboardingStart('plays_online')).toEqual({ kind: 'import' });
    expect(destinationPath(onboardingStart('plays_online'))).toBe('/onboarding/import');
  });

  test('every other level is unchanged from levelDestination', () => {
    for (const level of ['new', 'know_rules', 'casual'] as LearnerLevel[]) {
      expect(onboardingStart(level)).toEqual(levelDestination(level));
    }
  });

  test('levelDestination with no count still falls back to placement', () => {
    // The old behaviour is deliberately preserved: `needsAssessment` relies on it,
    // so a learner who has not imported is still owed an assessment.
    expect(levelDestination('plays_online')).toEqual({ kind: 'placement' });
  });

  test('levelDestination opens the import branch once it has a real count', () => {
    expect(levelDestination('plays_online', IMPORT_MIN_GAMES)).toEqual({ kind: 'import' });
    expect(levelDestination('plays_online', IMPORT_MIN_GAMES - 1)).toEqual({ kind: 'placement' });
    expect(IMPORT_MIN_GAMES).toBe(10);
  });
});

describe('the import route decides where onboarding goes next', () => {
  async function renderAt(games: number) {
    finished.games = games;
    const { ImportRoute } = await import('./ImportRoute');
    render(
      <MemoryRouter initialEntries={['/onboarding/import']}>
        <Where />
        <Routes>
          <Route path="/onboarding/import" element={<ImportRoute />} />
          <Route path="/onboarding/placement" element={<p>placement</p>} />
          <Route path="/" element={<p>today</p>} />
        </Routes>
      </MemoryRouter>,
    );
    return screen.getByRole('button', { name: /finish import/i });
  }

  test('ten or more imported games carries the learner on, with no placement test', async () => {
    const finish = await renderAt(10);
    await userEvent.click(finish);
    expect(screen.getByTestId('where')).toHaveTextContent('/');
    expect(screen.getByText('today')).toBeInTheDocument();
  });

  test('fewer than ten games takes F-ON-2 placement-test fallback', async () => {
    const finish = await renderAt(9);
    await userEvent.click(finish);
    expect(screen.getByTestId('where')).toHaveTextContent('/onboarding/placement');
    expect(screen.getByText('placement')).toBeInTheDocument();
  });

  test('an import that brought nothing takes the fallback too', async () => {
    const finish = await renderAt(0);
    await userEvent.click(finish);
    expect(screen.getByText('placement')).toBeInTheDocument();
  });

  test('the learner can skip import and take the placement test instead', async () => {
    await renderAt(50);
    await userEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(screen.getByText('placement')).toBeInTheDocument();
  });
});
