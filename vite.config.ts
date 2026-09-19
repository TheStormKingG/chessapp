/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves from /chessapp/ until a domain is chosen.
const base = process.env['NODE_ENV'] === 'production' ? '/chessapp/' : '/';

export default defineConfig({
  base,
  resolve: { alias: { '@': '/src', '@content': '/content' } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'ChessApp',
        short_name: 'ChessApp',
        description: 'Learn chess from zero to club level, free.',
        theme_color: '#F6F8FA', // --surface-raised (NEUMORPHIC-DELTA.md §3)
        background_color: '#E0E5EC', // --surface
        display: 'standalone',
        orientation: 'portrait',
        // Relative to the manifest, which Vite emits at the build's base, so
        // these follow whatever `--base` the build actually used. The previous
        // absolute `base` was computed from NODE_ENV when this config was
        // evaluated and ignored the flag, so `vite build --base=/` shipped a
        // manifest scoped to a path that did not exist.
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        globIgnores: ['engine/**'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/engine/'),
            handler: 'CacheFirst',
            options: { cacheName: 'engine', expiration: { maxEntries: 4 } },
          },
          // `public/data/openings.txt` is ~300 KiB and `globPatterns` above
          // deliberately omits `txt`: precaching it would charge every first
          // load for a feature a learner only reaches after finishing a game,
          // and Task 5's shell budget is measured on that first load. Caching
          // it at runtime instead means the first review pays for it once and
          // every later review — including an offline one (F-RV-10) — is
          // served from disk. Its own cache name keeps an eviction of the
          // engine cache from taking the book with it, and the age bound lets
          // a rebuilt book reach returning clients, which a bare CacheFirst
          // never would.
          {
            urlPattern: ({ url }) => url.pathname.includes('/data/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'opening-book',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
