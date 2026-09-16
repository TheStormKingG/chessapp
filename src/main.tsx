import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/theme.css';

// GitHub Pages SPA redirect: 404.html sends /chessapp/path as /chessapp/?/path
const l = window.location;
if (l.search.startsWith('?/')) {
  const decoded = l.search.slice(2).split('&').map((s) => s.replace(/~and~/g, '&'));
  const path = decoded[0] ?? '';
  const query = decoded.slice(1).join('&');
  window.history.replaceState(null, '', `${import.meta.env.BASE_URL}${path}${query ? `?${query}` : ''}${l.hash}`);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
