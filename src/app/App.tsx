import { useEffect } from 'react';
import { BrowserRouter } from 'react-router';
import { useProgress } from '@/data';
import { InstallPrompt, UpdateNotice } from '@/pwa';
import { AppRoutes } from './routes';
import { AuthProvider } from '@/sync/AuthContext';
import { useKeepCurrent } from '@/import/useKeepCurrent';
import { useApplyCosmetics } from '@/engagement';

export function App() {
  const loaded = useProgress((s) => s.loaded);
  useEffect(() => {
    // The store sets its own state; nothing is set on this component.
    void useProgress.getState().load();
  }, []);
  /*
   * F-IM-4's on-open check, and F-IM-3's resumption of any analysis a previous
   * visit left pending. It does nothing at all for a learner with no linked
   * account, which is every learner who has not imported.
   */
  useKeepCurrent();
  /*
   * F-EN-6. Four custom properties on the document root, which is the whole
   * mechanism: `board/boardColors.ts` already resolves every board colour from the
   * root at render time, so no component learns that cosmetics exist. Applied here
   * rather than in the picker because it has to hold on every screen.
   */
  useApplyCosmetics();
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <UpdateNotice />
      <AuthProvider>{loaded ? <AppRoutes /> : <p className="p-4 text-content-dim">Loading…</p>}</AuthProvider>
      {loaded && <InstallPrompt />}
    </BrowserRouter>
  );
}
