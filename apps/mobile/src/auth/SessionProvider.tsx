import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getNativeWorkerContext, type WorkerContext } from '@yellowshifts/database/public';
type State = {
  phase: 'loading' | 'signedOut' | 'ready' | 'error';
  context: WorkerContext | null;
  error: string | null;
};
const initial: State = { phase: 'loading', context: null, error: null };
const AuthContext = createContext<{ state: State; retry: () => void; logout: () => Promise<void> }>(
  { state: initial, retry: () => {}, logout: async () => {} }
);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const generation = useRef(0);
  const resolve = useCallback(async (session: Session | null, run: number) => {
    if (run !== generation.current) return;
    setState({ phase: session ? 'loading' : 'signedOut', context: null, error: null });
    if (!session || !supabase) return;
    try {
      const context = await getNativeWorkerContext(supabase, session.user.id);
      if (run === generation.current)
        setState({
          phase: 'ready',
          context,
          error: null,
        });
    } catch {
      if (run === generation.current)
        setState({
          phase: 'error',
          context: null,
          error: 'לא הצלחנו לאמת את החשבון. בדקו את החיבור ונסו שוב.',
        });
    }
  }, []);
  const retry = useCallback(() => {
    if (!supabase) {
      setState({ phase: 'signedOut', context: null, error: null });
      return;
    }
    const run = ++generation.current;
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        return resolve(data.session, run);
      })
      .catch(() => {
        if (run === generation.current)
          setState({
            phase: 'error',
            context: null,
            error: 'לא הצלחנו לשחזר את ההתחברות. נסו שוב.',
          });
      });
  }, [resolve]);
  useEffect(() => {
    if (!supabase) {
      retry();
      return;
    }
    let alive = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Defer I/O until Supabase releases its auth lock.
      if (
        event === 'INITIAL_SESSION' ||
        event === 'SIGNED_IN' ||
        event === 'SIGNED_OUT' ||
        event === 'USER_UPDATED'
      ) {
        const run = ++generation.current;
        setTimeout(() => {
          if (alive) void resolve(session, run);
        }, 0);
      }
    });
    const listener = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        supabase!.auth.startAutoRefresh();
        retry();
      } else supabase!.auth.stopAutoRefresh();
    });
    if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();
    // Also surface storage initialization failures, which may prevent INITIAL_SESSION.
    retry();
    return () => {
      alive = false;
      generation.current++;
      subscription.unsubscribe();
      listener.remove();
      supabase!.auth.stopAutoRefresh();
    };
  }, [resolve, retry]);
  const logout = async () => {
    const run = ++generation.current;
    setState({ phase: 'loading', context: null, error: null });
    try {
      const result = await supabase?.auth.signOut({ scope: 'local' });
      if (result?.error) throw result.error;
      if (run === generation.current) setState({ phase: 'signedOut', context: null, error: null });
    } catch {
      if (run === generation.current)
        setState({
          phase: 'error',
          context: null,
          error: 'ההתנתקות לא הושלמה. בדקו את החיבור ונסו שוב.',
        });
    }
  };
  return <AuthContext.Provider value={{ state, retry, logout }}>{children}</AuthContext.Provider>;
}
export const useSession = () => useContext(AuthContext);
