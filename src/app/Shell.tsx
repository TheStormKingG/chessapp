import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { TabIcon, type TabSymbol } from './TabIcon';

const tabs: { to: string; label: string; symbol: TabSymbol; end?: boolean }[] = [
  { to: '/', label: 'Today', symbol: 'today', end: true },
  { to: '/path', label: 'Path', symbol: 'path' },
  { to: '/puzzles', label: 'Puzzles', symbol: 'puzzles' },
  { to: '/play', label: 'Play', symbol: 'play' },
  { to: '/progress', label: 'Progress', symbol: 'progress' },
];

/**
 * The browsable sections of the app. Modal tasks — a lesson, a checkpoint, a
 * game in play — are not rendered here; see `ModalTask` and `routes.tsx`.
 *
 * Regular width (chunk B3): the shell spans the window instead of sitting in a
 * 1024px box with a dead margin on either side, the rail is pinned to the
 * leading edge at its own width, and the section's content is centred in what
 * is left at a readable measure. `layout.md > Best practices`: "Extend content
 * to fill the screen or window", and "Place items to convey their relative
 * importance" — the rail leads, the content follows it.
 */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full md:flex-row">
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-edge-strong bg-surface-raised md:sticky md:inset-x-auto md:top-0 md:bottom-auto md:h-dvh md:w-60 md:shrink-0 md:border-t-0 md:border-r"
      >
        {/* A wordmark, not a heading: the screens own the document outline. */}
        <p className="t-label hidden px-4 pt-5 pb-3 font-semibold tracking-wide text-content-dim md:block">ChessApp</p>
        <ul className="flex md:flex-col md:gap-1 md:px-2">
          {tabs.map((t) => (
            <li key={t.to} className="flex-1">
              <NavLink
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `tap t-caption flex flex-col items-center justify-center gap-1 px-2 py-2 md:t-label md:flex-row md:justify-start md:gap-3 md:rounded-lg md:px-3 ${
                    isActive ? 'text-accent font-semibold' : 'text-content-dim'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <TabIcon name={t.symbol} active={isActive} />
                    {t.label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main className="min-w-0 flex-1 pb-20 md:pb-0">
        {/* NEUMORPHIC-DELTA.md §7.3: the cap is 1120px, not 768px. The
            reference caps its own measure at 1024 and ranks a page vertically
            rather than stretching it, so the answer to a 2000px window is a
            wider CAP with real margin beside it -- 320px each side at 2000 --
            not a 752px column with 496px of void. */}
        <div className="mx-auto w-full md:max-w-[1120px] md:px-2">{children}</div>
      </main>
    </div>
  );
}
