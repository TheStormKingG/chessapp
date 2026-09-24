import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSettings } from '@/app/settings';
import { LessonPlayer } from './LessonPlayer';
import type { Lesson } from './types';

/*
 * `guess_the_move` renders its commentary.
 *
 * The defect these cover is not a crash and not a wrong answer: the type has
 * always accepted the move correctly. `commentary` was declared in the type, in
 * both schemas and in the verifier, and NO component read it -- so a story game
 * was a `find_the_move` wearing a different name, and every test the type had
 * still passed. That is why the control below (a `find_the_move` in the same
 * lesson showing nothing) matters as much as the positive case: without it,
 * "the annotation is on screen" would also pass for a component that rendered
 * unconditionally, which is the mirror image of the bug.
 */

const board = vi.hoisted(() => ({ move: { from: 'e2', to: 'e4', uci: 'e2e4', san: 'e4' } }));
vi.mock('@/board', () => ({
  Board: ({
    fen,
    disabled,
    onMove,
  }: {
    fen: string;
    disabled?: boolean;
    onMove?: (m: { from: string; to: string; uci: string; san: string }) => void;
  }) => (
    <div>
      <span data-testid="fen">{fen}</span>
      <button type="button" disabled={disabled} onClick={() => onMove?.(board.move)}>
        play
      </button>
    </div>
  ),
}));

vi.mock('@/engine', () => ({ getEngine: () => ({ bestMove: vi.fn() }) }));

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const COMMENTARY =
  'Morphy opens the position he means to attack in. Every piece he develops from here already has a square.';

beforeEach(() => {
  board.move = { from: 'e2', to: 'e4', uci: 'e2e4', san: 'e4' };
  useSettings.setState({ coachMuted: false });
});

/** One story-game challenge. The answer is given in UCI, so SAN is derived. */
function storyLesson(over: Partial<Lesson> = {}): Lesson {
  return {
    id: '9.9.1',
    unit: '9.9',
    title: 'Morphy at the Opera',
    xp: 5,
    card: { idea: 'Watch a game', diagrams: [] },
    explain: [],
    challenges: [
      {
        id: 'g1',
        type: 'guess_the_move',
        fen: START,
        prompt: 'Morphy has the white pieces. What did he open with?',
        concept: 'centre',
        answer: { moves: ['e2e4'] },
        commentary: COMMENTARY,
      },
    ],
    takeaway: 'A story game is a game you play along with.',
    ...over,
  };
}

async function startLesson(lesson: Lesson) {
  render(<LessonPlayer lesson={lesson} onComplete={() => {}} onExit={() => {}} />);
  await userEvent.click(screen.getByRole('button', { name: /start/i }));
}

test('the commentary is withheld until the move is settled, then shown with the move in SAN', async () => {
  await startLesson(storyLesson());

  // While the learner is still choosing, the paragraph would BE the answer.
  expect(screen.queryByRole('note', { name: 'From the game' })).toBeNull();
  expect(screen.queryByText(COMMENTARY)).toBeNull();

  await userEvent.click(screen.getByRole('button', { name: 'play' }));

  const note = screen.getByRole('note', { name: 'From the game' });
  expect(note).toHaveTextContent(COMMENTARY);
  // The answer is authored as UCI and printed as SAN -- "e4", not "e2e4".
  // Asserting both directions, because a component that printed the raw string
  // would still contain "e4" as a substring.
  const label = note.querySelector('[data-annotation-move]');
  expect(label).toHaveTextContent('e4');
  expect(note).not.toHaveTextContent('e2e4');
});

test('a learner who gives up still gets the story', async () => {
  await startLesson(storyLesson());
  await userEvent.click(screen.getByRole('button', { name: /show me/i }));
  // The annotation says what the move meant in the game, which is true whether
  // the learner found it or not. Withholding it here would punish giving up by
  // removing the teaching rather than the credit.
  expect(screen.getByRole('note', { name: 'From the game' })).toHaveTextContent(COMMENTARY);
});

test('the coach still gets their own line, and it is not the annotation', async () => {
  await startLesson(storyLesson());
  await userEvent.click(screen.getByRole('button', { name: 'play' }));

  // Two notes, two voices. The coach reacts to what the learner did; the
  // annotation says what the move meant. Routing the commentary through
  // CoachBubble would have cost one of them, and a screen reader would hear one
  // `role="note"` where there are two claims.
  const notes = screen.getAllByRole('note');
  expect(notes.length).toBeGreaterThanOrEqual(2);
  const coach = notes.find((n) => n.getAttribute('aria-label')?.endsWith('says'));
  expect(coach).toBeDefined();
  expect(coach).not.toHaveTextContent(COMMENTARY);
  expect(coach?.textContent?.trim()).not.toBe('');
});

test('a challenge of any other type renders no annotation', async () => {
  // The control. "The annotation appears" is only evidence if there is a case
  // where it does not, and this is the case the old code got right by doing
  // nothing at all.
  await startLesson(
    storyLesson({
      challenges: [
        {
          id: 'f1',
          type: 'find_the_move',
          fen: START,
          prompt: 'Open the game.',
          concept: 'centre',
          answer: { moves: ['e2e4'] },
        },
      ],
    }),
  );
  await userEvent.click(screen.getByRole('button', { name: 'play' }));
  expect(screen.queryByRole('note', { name: 'From the game' })).toBeNull();
});

test('an unparseable answer still gets its paragraph', async () => {
  // The verifier rejects an illegal answer move before it can ship, so this is
  // a state the app should never be in -- which is exactly why the paragraph
  // must not be what disappears. Dropping the annotation would hide the fault;
  // printing the raw string surfaces it next to the text it belongs to.
  await startLesson(
    storyLesson({
      challenges: [
        {
          id: 'g2',
          type: 'guess_the_move',
          fen: START,
          prompt: 'What did he open with?',
          concept: 'centre',
          // Not a legal move in this position, and not a SAN either.
          answer: { moves: ['h1h8'] },
          commentary: COMMENTARY,
        },
      ],
    }),
  );
  await userEvent.click(screen.getByRole('button', { name: /show me/i }));
  const note = screen.getByRole('note', { name: 'From the game' });
  expect(note).toHaveTextContent(COMMENTARY);
  // The raw string, printed rather than swallowed.
  expect(note.querySelector('[data-annotation-move]')).toHaveTextContent('h1h8');
});

test('an empty commentary renders nothing rather than an empty note', async () => {
  await startLesson(
    storyLesson({
      challenges: [
        {
          id: 'g3',
          type: 'guess_the_move',
          fen: START,
          prompt: 'What did he open with?',
          concept: 'centre',
          answer: { moves: ['e2e4'] },
          commentary: '   ',
        },
      ],
    }),
  );
  await userEvent.click(screen.getByRole('button', { name: /show me/i }));
  // Whitespace satisfies the schema's `minLength: 1`; the verifier rejects it
  // too, but a note containing only a move label and no prose would be a worse
  // thing to render than nothing.
  expect(screen.queryByRole('note', { name: 'From the game' })).toBeNull();
});
