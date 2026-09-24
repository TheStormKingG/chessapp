import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { db, emptyProgress, useProgress } from '@/data';
import { PathScreen } from './PathScreen';

/*
 * The Path opens where the learner is.
 *
 * Measured on a 390px phone with the full v1 curriculum declared: the document
 * is 11,218px and a learner part-way through Section 3 sits 6,075px down --
 * seven and a half screens of finished work between them and their own
 * position. Declaring Section 4 made the document 38% taller, so this is the
 * normal case rather than an edge one.
 *
 * jsdom has no layout and does not implement `scrollIntoView`, so both are
 * stubbed. That makes these tests about the DECISION -- does it scroll, and
 * with what options -- which is the part that has a right answer. Whether the
 * browser then places the row correctly is the browser's job, and was checked
 * by measuring the real document.
 */

function renderPath() {
  render(
    <MemoryRouter>
      <PathScreen />
    </MemoryRouter>,
  );
}

/** Report every row at `top`, which is the only thing the decision reads. */
function layoutAt(top: number) {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    top,
    bottom: top + 60,
    left: 0,
    right: 320,
    width: 320,
    height: 60,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect);
}

function stubScrollIntoView() {
  const spy = vi.fn();
  // jsdom leaves this undefined, so it is defined rather than spied on.
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    value: spy,
    configurable: true,
    writable: true,
  });
  return spy;
}

function setReducedMotion(reduce: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (q: string) =>
      ({
        matches: q.includes('prefers-reduced-motion') ? reduce : false,
        media: q,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

beforeEach(async () => {
  await db.resume.clear();
  localStorage.clear();
  useProgress.setState({ progress: emptyProgress() });
  window.innerWidth = 390;
  window.innerHeight = 812;
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('the active row is marked in the DOM, and only that row', () => {
  stubScrollIntoView();
  renderPath();
  // The scroll target has to be findable at all, and findable UNIQUELY -- a
  // second marked row would make the query's result depend on document order.
  const marked = document.querySelectorAll('[data-path-active]');
  expect(marked).toHaveLength(1);
  expect(marked[0]).toHaveTextContent('Up next');
});

test('a learner below the fold is scrolled to their position', () => {
  const scroll = stubScrollIntoView();
  layoutAt(6075); // the measured offset of a mid-Section-3 learner
  setReducedMotion(false);
  renderPath();
  expect(scroll).toHaveBeenCalledTimes(1);
  // Centred, not `start`: the rows above a learner's position are the work
  // they have done, and seeing some of it is the point of the screen.
  expect(scroll).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
});

test('a learner already looking at their position is left alone', () => {
  // The control, and the reason the visibility test exists at all. Without it
  // this feature would jump the page for every Section 1 learner -- who make up
  // everyone starting the app -- to move them somewhere they already were.
  const scroll = stubScrollIntoView();
  layoutAt(140); // unit 1.1.1's measured offset, comfortably on screen
  renderPath();
  expect(scroll).not.toHaveBeenCalled();
});

test('reduced motion gets an instant jump, not no jump', () => {
  const scroll = stubScrollIntoView();
  layoutAt(6075);
  setReducedMotion(true);
  renderPath();
  // The preference asks for the travel to be removed, not for the learner to
  // be abandoned at the top of an eleven-thousand-pixel document.
  expect(scroll).toHaveBeenCalledWith({ block: 'center', behavior: 'auto' });
});

test('finishing a lesson while the Path is open does not move the page', () => {
  const scroll = stubScrollIntoView();
  layoutAt(6075);
  renderPath();
  expect(scroll).toHaveBeenCalledTimes(1);
  const before = document.querySelector('[data-path-active]')?.textContent ?? '';

  // Progress changes under an open Path -- a checkpoint passed in another tab,
  // or a lesson completing. Re-running the scroll here would yank the document
  // while the learner is reading it.
  const p = emptyProgress();
  p.units['1.1'] = { passed: true, attempts: 1, failedAttempts: 0, testedOut: false };
  act(() => {
    useProgress.setState({ progress: p });
  });
  expect(scroll).toHaveBeenCalledTimes(1);
  // ...and the screen really did re-render, so the assertion above is about
  // the effect not firing rather than about nothing having happened. Passing
  // unit 1.1 moves the active node off 1.1.1, so the marked row's own text is
  // the proof: it is a different row than it was.
  expect(before).toContain('The board');
  const after = document.querySelector('[data-path-active]')?.textContent ?? '';
  expect(after).not.toBe(before);
});

test('no layout support is a no-op rather than a crash', () => {
  // jsdom's own state, and the state of any environment without a layout
  // engine: the guard is what keeps the Path renderable in tests at all.
  // @ts-expect-error -- removing the stub is the point of this test
  delete Element.prototype.scrollIntoView;
  expect(() => {
    renderPath();
  }).not.toThrow();
  expect(document.querySelectorAll('[data-path-active]')).toHaveLength(1);
});
