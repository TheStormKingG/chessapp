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
  {
    name: 'lichess-org/chess-openings',
    licence: 'CC0-1.0',
    note:
      'The names of the opening lines, used to tell you which opening you played and where you left it. Dedicated to the public domain under CC0 1.0; ChessApp ships a derived index of the lines, not the original files.',
    links: [{ label: 'Project', href: 'https://github.com/lichess-org/chess-openings' }],
  },
  {
    name: 'Lichess puzzle database',
    licence: 'CC0-1.0',
    note:
      'The positions you solve in the Puzzles tab. Dedicated to the public domain under CC0 1.0; ChessApp ships a curated derived subset, not the original files — about 7,900 puzzles across three rating bands, filtered to the eight motifs Sections 1 and 2 teach.',
    links: [{ label: 'Project', href: 'https://database.lichess.org/' }],
  },
];

/**
 * NEUMORPHIC-DELTA.md §6 / chunk N2. Eleven containers, one grammar: each entry
 * is a `--surface-raised` panel on `--shadow-raised` at `--radius-card`, with
 * no border at all. The 1px `--edge-strong` ring is gone for the reason §3.1
 * gives that token — it is "every control border" — and a licence entry is
 * several paragraphs of prose, not a control. The links inside each card are the
 * interactive things here and they keep their own affordances: `--accent` ink
 * plus a permanent underline, so "this is a link" is never carried by colour
 * alone, and `.tap` with `inline-flex` so the 44px floor is not inert on an
 * inline element (observation 0103).
 *
 * Re-derived against the new ground rather than copied (observation 0113):
 * `--content` #0F172B on `--surface-raised` #F6F8FA is **16.75:1**;
 * `--content-dim` #475569 on it is **7.12:1**; `--accent` #12614A on it is
 * **6.96:1**. The list stands 16px clear of its neighbours, which is what makes
 * a soft-shadowed stack read as separate cards rather than one long one.
 */
export function LicencesScreen() {
  return (
    <section className="p-4">
      <h1 className="t-display">Licences</h1>
      <p className="mt-2 text-content-dim">
        ChessApp is built on free and open-source software. Every third-party component we ship is listed here
        with its licence.
      </p>
      <ul className="mt-4 space-y-4">
        {entries.map((e) => (
          <li key={e.name} className="n-raised rounded-card bg-surface-raised p-4 [overflow-wrap:anywhere]">
            <h2 className="t-heading">
              {e.name}
              {e.version ? ` ${e.version}` : ''}
            </h2>
            <p className="t-caption uppercase tracking-wide text-content-dim">{e.licence}</p>
            <p className="t-body mt-2">{e.note}</p>
            <ul className="t-label mt-2 space-y-1">
              {e.links.map((l) => (
                <li key={l.href}>
                  <a className="tap inline-flex items-center [overflow-wrap:anywhere] text-accent underline" href={l.href} rel="noreferrer" target="_blank">
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
