import { create } from 'zustand';
import { createClient, type Session } from '@supabase/supabase-js';

/** Anon key only: it is a public identifier and RLS is what protects rows (PRD 11). */
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseEnabled = Boolean(url && key);
export const supabase = supabaseEnabled ? createClient(url, key) : null;

export type SyncState = 'idle' | 'syncing' | 'error';

interface AuthState {
  session: Session | null;
  syncState: SyncState;
}

/**
 * Session and sync state live in a store rather than component state, so
 * AuthProvider's effects never call a React setter during an effect (the repo
 * lints react-hooks/set-state-in-effect at --max-warnings 0). Keeping the hook
 * and the two actions here also keeps AuthContext.tsx exporting only its
 * component, which react-refresh/only-export-components requires.
 */
export const useAuthState = create<AuthState>(() => ({ session: null, syncState: 'idle' }));

export function useAuth(): AuthState & { enabled: boolean } {
  const session = useAuthState((s) => s.session);
  const syncState = useAuthState((s) => s.syncState);
  return { session, syncState, enabled: supabaseEnabled };
}

/** F-AC-2: sign-up and sign-in are the same magic link to an email address. */
export async function signIn(email: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
  });
  if (error) throw new Error(error.message);
}

/** Guest data stays on the device unless the learner clears it (F-AC-2). */
export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}
