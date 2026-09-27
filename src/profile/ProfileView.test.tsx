import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, test } from 'vitest';
import { buildProfile } from './buildProfile';
import { ProfileView } from './ProfileView';
import { profileSignature, useProfileSeen } from './seen';
import { COMPARISON_MIN_GAMES } from './sampleSize';
import { SKILL_TITLE, SKILL_IDS, type Profile } from './types';
import { games, type GameSpec } from './testGames';
import type { BandStatsSource } from './bandStats';

const hung: GameSpec = {
  moves: [{ label: 'Mistake', drop: 30, winBefore: 70, accuracy: 40 }],
  errors: [{ theme: 'hung_piece', ply: 0 }],
};

function show(profile: Profile, undateable = 0) {
  return render(
    <MemoryRouter>
      <ProfileView profile={profile} undateable={undateable} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useProfileSeen.setState({ lastSeen: null });
});

// ── F-SW-6: the sample size, on the screen ──────────────────────────────────

test('the screen says how many games the profile rests on', () => {
  show(buildProfile(games(14, () => hung)));
  expect(screen.getByRole('status')).toHaveTextContent('Built on 14 analysed games.');
});

test('one game reads as one game', () => {
  show(buildProfile(games(1, () => hung)));
  expect(screen.getByRole('status')).toHaveTextContent('Built on 1 analysed game.');
});

test('the sample-size line is the screens one live region', () => {
  // A second live region would talk over the first. The requirement is "a live
  // region announces change without competing with what is on screen".
  show(buildProfile(games(14, () => hung)));
  const live = document.querySelectorAll('[aria-live]');
  expect(live).toHaveLength(1);
  expect(live[0]).toHaveAttribute('aria-live', 'polite');
  expect(live[0]).toHaveAttribute('role', 'status');
});

test('below ten games the screen says comparisons need ten games', () => {
  show(buildProfile(games(COMPARISON_MIN_GAMES - 1, () => hung)));
  expect(screen.getByRole('status')).toHaveTextContent('comparisons with other players at your level start at ten games');
});

test('above ten games with no statistics the screen says why, and does not say to play more', () => {
  // The two reasons must not be confused: telling a learner to play ten more games
  // when the real cause is missing reference data is telling them to do something
  // that cannot work.
  const status = show(buildProfile(games(40, () => hung))).container.querySelector('[role="status"]');
  expect(status?.textContent).toContain('ships no statistics for other players at your level');
  expect(status?.textContent).toContain('never average');
  expect(status?.textContent).not.toContain('start at ten games');
});

test('POSITIVE CONTROL: with statistics the screen prints comparisons beside the numbers', () => {
  // Every other test here asserts comparisons are absent. Without this one they
  // would all pass against a screen that could not render a comparison at all.
  const source: BandStatsSource = { hasData: true, typicalFor: () => 1 };
  show(buildProfile(games(40, () => hung), { rating: 800, source }));
  expect(screen.getByRole('status')).not.toHaveTextContent('Counts only');
  // The comparisons live inside the skill panels, so one has to be opened.
  const button = screen.getByRole('button', { name: new RegExp(SKILL_TITLE.boardVision) });
  return userEvent.click(button).then(() => {
    // Both rows of the Board vision panel carry one, so `getAllByText`: the claim
    // is that comparisons render at all, not that exactly one does.
    expect(screen.getAllByText(/most 800s/).length).toBeGreaterThan(0);
  });
});

// ── F-SW-2 and F-SW-3 ───────────────────────────────────────────────────────

test('strengths come before weaknesses in the document', () => {
  // F-SW-2: "strengths are never an afterthought". The order is the requirement.
  const clean: GameSpec = { moves: [{ accuracy: 80, phase: 'middlegame' }] };
  show(buildProfile([...games(8, () => clean), ...games(2, () => hung, 8)]));
  const strengths = screen.getByRole('heading', { name: 'What you do well' });
  const weaknesses = screen.getByRole('heading', { name: 'What to work on' });
  expect(strengths.compareDocumentPosition(weaknesses) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('a weakness shows its name, its count and both links', () => {
  show(buildProfile(games(20, () => hung)));
  expect(screen.getByText('Leaving pieces free to take')).toBeInTheDocument();
  expect(screen.getByText('20 times in 20 games')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /^Lesson:/ })).toHaveAttribute('href', '/lesson/1.2.4');
  expect(screen.getByRole('link', { name: /^Drill:/ })).toHaveAttribute('href', '/puzzles/fix');
});

test('weaknesses are ranked by a number, not by a colour', () => {
  // "Nothing carried by colour alone." The rank is the ordering signal and it is a
  // digit in the index face.
  const mate: GameSpec = {
    moves: [{ label: 'Mistake', drop: 50, winBefore: 70 }],
    errors: [{ theme: 'missed_mate', ply: 0 }],
  };
  show(buildProfile([...games(10, () => hung), ...games(10, () => mate, 10)]));
  const items = screen.getAllByRole('listitem');
  const ranked = items.filter((li) => /^[123]$/.test(li.textContent?.trim().charAt(0) ?? ''));
  expect(ranked.length).toBeGreaterThanOrEqual(2);
  expect(within(ranked[0] as HTMLElement).getByText('1')).toBeInTheDocument();
});

test('a learner with no analysed games gets an empty state and a way out of it', () => {
  show(buildProfile([]));
  // Scoped to the empty state's own sentence: the collapsed skill panels each
  // carry "No analysed games yet." as an absent-measure reason, so an unscoped
  // match finds a dozen.
  expect(screen.getByText(/No analysed games yet\. Play a game/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /import your games/ })).toHaveAttribute('href', '/import');
  // And no invented strengths or weaknesses.
  expect(screen.queryByRole('heading', { name: 'What you do well' })).toBeNull();
  expect(screen.queryByRole('heading', { name: 'What to work on' })).toBeNull();
});

// ── F-SW-4: the six skills and their detail ─────────────────────────────────

test('all six skills are listed, each as a named control carrying its number', () => {
  show(buildProfile(games(14, () => hung)));
  for (const id of SKILL_IDS) {
    const button = screen.getByRole('button', { name: new RegExp(`^${SKILL_TITLE[id]},`) });
    expect(button, id).toBeInTheDocument();
    expect(button, id).toHaveAttribute('aria-expanded', 'false');
    // The name carries the measurement, so six collapsed rows read as six numbers.
    expect(button.getAttribute('aria-label') ?? '', id).toMatch(/, (.+)$/);
  }
});

test('tapping a skill opens its breakdown and says so on the control', async () => {
  const user = userEvent.setup();
  show(buildProfile(games(14, () => hung)));
  const button = screen.getByRole('button', { name: new RegExp(`^${SKILL_TITLE.boardVision},`) });
  expect(screen.queryByText('Pieces left free to take, per game')).not.toBeVisible();
  await user.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Pieces left free to take, per game')).toBeVisible();
  await user.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'false');
});

test('a skill states what it cannot measure rather than leaving a gap', async () => {
  const user = userEvent.setup();
  show(buildProfile(games(14, () => hung)));
  await user.click(screen.getByRole('button', { name: new RegExp(`^${SKILL_TITLE.habits},`) }));
  expect(screen.getByRole('heading', { name: 'Not measured' })).toBeVisible();
  expect(screen.getByText(/habit-score trend/)).toBeVisible();
  expect(screen.getByText(/under ten seconds/)).toBeVisible();
});

test('expanding a skill is not announced in the live region', () => {
  // It is the learner's own action, the state is on the button, and a second
  // announcement would talk over the content they just opened.
  show(buildProfile(games(14, () => hung)));
  const status = screen.getByRole('status');
  const before = status.textContent;
  const button = screen.getByRole('button', { name: new RegExp(`^${SKILL_TITLE.tactics},`) });
  return userEvent.click(button).then(() => {
    expect(screen.getByRole('status').textContent).toBe(before);
  });
});

// ── F-SW-7 ──────────────────────────────────────────────────────────────────

test('what changed says how many more games it needs when it cannot compare', () => {
  show(buildProfile(games(14, () => hung)));
  expect(screen.getByRole('heading', { name: 'What changed' })).toBeInTheDocument();
  expect(screen.getByText(/needs 26 more games/)).toBeInTheDocument();
});

test('what changed reports the comparison once there are two full windows', () => {
  const clean: GameSpec = { moves: [{ accuracy: 80 }] };
  // The second block is offset by 20, or both blocks occupy the same twenty days
  // and the same twenty ids and F-SW-7's windows interleave. See testGames.ts.
  show(buildProfile([...games(20, () => clean), ...games(20, () => hung, 20)]));
  expect(screen.getByText(/You have stopped leaving pieces free to take\./)).toBeInTheDocument();
  expect(screen.queryByText(/more games/)).toBeNull();
});

// ── F-SW-8 ──────────────────────────────────────────────────────────────────

test('both exports are offered as named links with a filename', () => {
  show(buildProfile(games(14, () => hung)));
  const image = screen.getByRole('link', { name: 'Download image' });
  const data = screen.getByRole('link', { name: 'Download data' });
  expect(image.getAttribute('download')).toMatch(/^chessapp-profile-\d{4}-\d{2}-\d{2}\.svg$/);
  expect(data.getAttribute('download')).toMatch(/^chessapp-profile-\d{4}-\d{2}-\d{2}\.json$/);
  expect(image).toHaveAttribute('href', expect.stringContaining('data:image/svg+xml'));
  expect(data).toHaveAttribute('href', expect.stringContaining('data:application/json'));
});

test('the previewed image has alternative text carrying its content', () => {
  show(buildProfile(games(14, () => hung)));
  const img = screen.getByRole('img');
  const alt = img.getAttribute('alt') ?? '';
  expect(alt).toContain('14 analysed games');
  expect(alt).toContain('Leaving pieces free to take');
  expect(alt).not.toBe('');
});

// ── F-SW-1's "reachable from Today when it has changed" ─────────────────────

test('opening the profile marks it seen, so Today stops offering it', () => {
  const p = buildProfile(games(6, () => hung));
  expect(useProfileSeen.getState().lastSeen).toBeNull();
  show(p);
  expect(useProfileSeen.getState().lastSeen).toBe(profileSignature(p));
});

// ── Honesty across the whole rendered screen ────────────────────────────────

test('no rendered text claims anything about other players', () => {
  const clean: GameSpec = { moves: [{ accuracy: 80, phase: 'middlegame' }] };
  const { container } = show(buildProfile([...games(20, () => clean), ...games(20, () => hung, 20)]));
  const text = container.textContent ?? '';
  expect(text.length).toBeGreaterThan(200);
  // No band is named anywhere, and no "than most" comparison is made. The one
  // permitted mention of other players is the note explaining their absence.
  expect(text).not.toMatch(/than most \d/);
  expect(text).not.toMatch(/most \d{3,4}s/);
  expect(text).not.toContain('players at your level miss this too');
  expect(text).not.toContain('unusual for your level');
});

test('nothing renders as undefined or NaN at any sample size', () => {
  for (const n of [0, 1, 9, 10, 30, 41]) {
    const { container, unmount } = show(buildProfile(games(n, () => hung)));
    expect(container.textContent ?? '', `n=${String(n)}`).not.toMatch(/undefined|NaN|Infinity/);
    unmount();
  }
});
