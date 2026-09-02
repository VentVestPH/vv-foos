import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type {
  CandidateStatus,
  Company,
  Person,
  Source,
  StaffRow,
} from './lib';

export async function fetchPeopleByIds(ids: string[]): Promise<Person[]> {
  const out: Person[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data, error } = await supabase
      .from('people')
      .select('*')
      .in('id', chunk);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
  }
  return out;
}

export interface Lookups {
  companies: Company[];
  staff: StaffRow[];
  sources: Source[];
  statuses: CandidateStatus[];
  loading: boolean;
  error: string | null;
}

export function useLookups(): Lookups {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [statuses, setStatuses] = useState<CandidateStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [c, st, so, cs] = await Promise.all([
        supabase.from('companies').select('*').order('name'),
        supabase
          .from('staff')
          .select('*')
          .eq('is_active', true)
          .order('full_name'),
        supabase.from('sources').select('*').order('name'),
        supabase
          .from('candidate_statuses')
          .select('*')
          .order('sort_order'),
      ]);
      if (cancelled) return;
      const firstError =
        c.error ?? st.error ?? so.error ?? cs.error ?? null;
      if (firstError) setError(firstError.message);
      setCompanies(c.data ?? []);
      setStaffList(st.data ?? []);
      setSources(so.data ?? []);
      setStatuses(cs.data ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { companies, staff: staffList, sources, statuses, loading, error };
}

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 640px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const onChange = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return mobile;
}
