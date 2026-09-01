import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { StaffRole, Tables } from '../lib/database.types';

type Staff = Tables<'staff'>;

interface SessionState {
  /** Supabase auth session; null when signed out. */
  session: Session | null;
  /** The signed-in user's staff row (staff.id = auth.users.id); null until loaded. */
  staff: Staff | null;
  /** Role from staff.role. RLS is the real boundary; this only shapes the UI. */
  role: StaffRole | null;
  /** True while the initial session + staff lookup is in flight. */
  loading: boolean;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState>({
  session: null,
  staff: null,
  role: null,
  loading: true,
  signOut: async () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadStaff(s: Session | null) {
      if (!s) {
        if (!cancelled) setStaff(null);
        return;
      }
      const { data } = await supabase
        .from('staff')
        .select('*')
        .eq('id', s.user.id)
        .maybeSingle();
      if (!cancelled) setStaff(data ?? null);
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      await loadStaff(data.session);
      if (!cancelled) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        void loadStaff(newSession);
      },
    );

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setStaff(null);
  };

  return (
    <SessionContext.Provider
      value={{ session, staff, role: staff?.role ?? null, loading, signOut }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}

/** Current user's role, or null while loading / signed out. */
export function useRole(): StaffRole | null {
  return useContext(SessionContext).role;
}
