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
  session: Session | null;

  staff: Staff | null;

  role: StaffRole | null;

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
  const [staffResolvedFor, setStaffResolvedFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadStaff(s: Session | null) {
      if (!s) {
        if (!cancelled) {
          setStaff(null);
          setStaffResolvedFor(null);
        }
        return;
      }
      const { data } = await supabase
        .from('staff')
        .select('*')
        .eq('id', s.user.id)
        .maybeSingle();
      if (!cancelled) {
        setStaff(data ?? null);
        setStaffResolvedFor(s.user.id);
      }
    }

    let loadedForUser: string | null | undefined;

    async function syncStaff(next: Session | null) {
      const userId = next?.user.id ?? null;
      if (loadedForUser === userId) return;
      loadedForUser = userId;
      await loadStaff(next);
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      await syncStaff(data.session);
      if (!cancelled) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        void syncStaff(newSession);
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
    setStaffResolvedFor(null);
  };

  const staffPending = session !== null && staffResolvedFor !== session.user.id;

  return (
    <SessionContext.Provider
      value={{
        session,
        staff,
        role: staff?.role ?? null,
        loading: loading || staffPending,
        signOut,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}

export function useRole(): StaffRole | null {
  return useContext(SessionContext).role;
}
