import type { ReactNode } from 'react';
import { NavLink } from 'react-router';

const tabs = [
  { to: '/', label: 'Today', end: true },
  { to: '/path', label: 'Path' },
  { to: '/puzzles', label: 'Puzzles' },
  { to: '/play', label: 'Play' },
  { to: '/progress', label: 'Progress' },
];

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full max-w-5xl md:flex-row">
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card md:static md:w-48 md:border-t-0 md:border-r">
        <ul className="flex md:flex-col">
          {tabs.map((t) => (
            <li key={t.to} className="flex-1">
              <NavLink
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `tap flex flex-col items-center justify-center px-2 py-2 text-xs md:flex-row md:justify-start md:gap-2 md:px-4 md:text-sm ${isActive ? 'text-accent font-semibold' : 'text-ink-muted'}`
                }
              >
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
    </div>
  );
}
