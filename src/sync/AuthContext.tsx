import { useEffect, type ReactNode } from 'react';
import { supabase, useAuthState } from './supabaseClient';
import { db, onEventAppended, useProgress } from '@/data';
import { flush, pullAll } from './flush';
import { mergeEvents } from './merge';

/** Owns the session subscription and the outbox flush; renders its children. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useAuthState((s) => s.session);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      useAuthState.setState({ session: data.session });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      useAuthState.setState({ session: s });
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  // On sign-in: upload the guest events, pull the account's, merge by id and
  // rebuild the projection from the combined log (F-AC-2). Then flush after
  // every write and whenever the device comes back online (F-AC-3).
  useEffect(() => {
    const client = supabase;
    if (!client || !session) return;
    const uid = session.user.id;
    const sync = async () => {
      useAuthState.setState({ syncState: 'syncing' });
      try {
        await flush(client, uid);
        const remote = await pullAll(client, uid);
        const local = await db.events.toArray();
        // Merge into Dexie and rebuild: append() projects incrementally, so
        // replaying fetched events through it would double-count them.
        await db.events.bulkPut(mergeEvents(local, remote));
        await useProgress.getState().rebuild();
        useAuthState.setState({ syncState: 'idle' });
      } catch {
        useAuthState.setState({ syncState: 'error' });
      }
    };
    void sync();
    const off = onEventAppended(() => {
      flush(client, uid).catch(() => {
        useAuthState.setState({ syncState: 'error' });
      });
    });
    const online = () => {
      void sync();
    };
    window.addEventListener('online', online);
    return () => {
      off();
      window.removeEventListener('online', online);
    };
  }, [session]);

  return children;
}
