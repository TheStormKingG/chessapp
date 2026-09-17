const base = import.meta.env.BASE_URL;

interface Entry {
  name: string;
  version?: string;
  licence: string;
  note: string;
  links: { label: string; href: string }[];
}

const entries: Entry[] = [
  {
    name: 'Stockfish (Stockfish.js)',
    version: '19.0.0',
    licence: 'GPL-3.0-or-later',
    note:
      'Stockfish is free software: you may redistribute it and modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the Licence or (at your option) any later version. It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. ChessApp ships the engine unmodified.',
    links: [
      { label: 'Exact source of the build we ship', href: `${base}engine/SOURCE.txt` },
      { label: 'Full GPL-3 licence text', href: `${base}engine/LICENSE` },
      { label: 'Engine notice', href: `${base}engine/NOTICE` },
    ],
  },
  {
    name: 'chess.js',
    licence: 'BSD-2-Clause',
    note: 'Move generation, legality and draw detection.',
    links: [{ label: 'Project', href: 'https://github.com/jhlywa/chess.js' }],
  },
  {
    name: 'react-chessboard',
    licence: 'MIT',
    note: 'The board component, including its default piece set.',
    links: [{ label: 'Project', href: 'https://github.com/Clariity/react-chessboard' }],
  },
  {
    name: 'Dexie',
    licence: 'Apache-2.0',
    note: 'The local IndexedDB store that keeps your progress on the device.',
    links: [{ label: 'Project', href: 'https://dexie.org' }],
  },
  {
    name: 'Workbox',
    licence: 'MIT',
    note: 'The service worker that makes lessons work offline.',
    links: [{ label: 'Project', href: 'https://developer.chrome.com/docs/workbox' }],
  },
  {
    name: 'vite-plugin-pwa',
    licence: 'MIT',
    note: 'Builds the service worker and the install manifest.',
    links: [{ label: 'Project', href: 'https://vite-pwa-org.netlify.app' }],
  },
  {
    name: 'supabase-js',
    licence: 'MIT',
    note: 'Optional account sign-in and progress sync.',
    links: [{ label: 'Project', href: 'https://github.com/supabase/supabase-js' }],
  },
  {
    name: 'zustand',
    licence: 'MIT',
    note: 'Application state.',
    links: [{ label: 'Project', href: 'https://github.com/pmndrs/zustand' }],
  },
  {
    name: 'React',
    licence: 'MIT',
    note: 'The user interface library, with React DOM and React Router.',
    links: [{ label: 'Project', href: 'https://react.dev' }],
  },
];

export function LicencesScreen() {
  return (
    <section className="p-4">
      <h1 className="text-xl font-semibold">Licences</h1>
      <p className="mt-2 text-content-dim">
        ChessApp is built on free and open-source software. Every third-party component we ship is listed here
        with its licence.
      </p>
      <ul className="mt-4 space-y-4">
        {entries.map((e) => (
          <li key={e.name} className="rounded-lg border border-edge-strong bg-surface-raised p-4">
            <h2 className="font-semibold">
              {e.name}
              {e.version ? ` ${e.version}` : ''}
            </h2>
            <p className="text-xs uppercase tracking-wide text-content-dim">{e.licence}</p>
            <p className="mt-2 text-sm">{e.note}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {e.links.map((l) => (
                <li key={l.href}>
                  <a className="tap text-accent underline" href={l.href} rel="noreferrer" target="_blank">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
