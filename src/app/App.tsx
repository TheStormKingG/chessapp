import { useEffect } from 'react';
import { BrowserRouter } from 'react-router';
import { useProgress } from '@/data';
import { InstallPrompt, UpdateNotice } from '@/pwa';
import { AppRoutes } from './routes';
import { AuthProvider } from '@/sync/AuthContext';

export function App() {
  const loaded = useProgress((s) => s.loaded);
  useEffect(() => {
    // The store sets its own state; nothing is set on this component.
    void useProgress.getState().load();
  }, []);
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <UpdateNotice />
      <AuthProvider>{loaded ? <AppRoutes /> : <p className="p-4 text-ink-muted">Loading…</p>}</AuthProvider>
      {loaded && <InstallPrompt />}
    </BrowserRouter>
  );
}
