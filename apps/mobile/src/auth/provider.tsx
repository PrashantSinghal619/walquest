import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { getAuthClient } from './client';

type AuthState = { session: Session | null; loading: boolean; configured: boolean; error: string | null };
const AuthContext = createContext<AuthState>({ session: null, loading: true, configured: false, error: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true, configured: false, error: null });
  useEffect(() => {
    let alive = true;
    let eventVersion = 0;
    const client = getAuthClient();
    if (!client) {
      // Keep configuration failure separate from a signed-out session.
      Promise.resolve().then(() => { if (alive) setState({ session: null, loading: false, configured: false, error: null }); });
      return () => { alive = false; };
    }
    const auth = client.auth;
    const { data: { subscription } } = auth.onAuthStateChange((_event, session) => {
      eventVersion++;
      if (alive) setState({ session, loading: false, configured: true, error: null });
    });
    void auth.getSession().then(({ data, error }) => {
      if (alive && eventVersion === 0) setState({ session: data.session, loading: false, configured: true, error: error ? 'Could not restore sign-in. Please try again.' : null });
    }).catch(() => {
      if (alive) setState({ session: null, loading: false, configured: true, error: 'Could not read secure session storage. Reopen Walquest to retry.' });
    });
    function refreshForState(active: boolean) {
      const result = active ? auth.startAutoRefresh() : auth.stopAutoRefresh();
      void result.catch(() => {
        if (alive) setState(previous => ({ ...previous, error: 'Session refresh is unavailable. Check your connection before signing in again.' }));
      });
    }
    refreshForState(AppState.currentState === 'active');
    const lifecycle = AppState.addEventListener('change', value => refreshForState(value === 'active'));
    return () => { alive = false; subscription.unsubscribe(); lifecycle.remove(); void auth.stopAutoRefresh().catch(() => undefined); };
  }, []);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
