import { useEffect, useState } from 'react';
import { fetchAllRows } from '../../lib/fetchAll';
import { supabase } from '../../lib/supabase';
import type { CandidateStatus, Company, Source, StaffRow } from './lib';

const COMPANY_OPTION_COLUMNS = 'id, name';

export type CompanyOption = Pick<Company, 'id' | 'name'>;

export interface Lookups {
  companies: CompanyOption[];
  staff: StaffRow[];
  sources: Source[];
  statuses: CandidateStatus[];
  loading: boolean;
  error: string | null;
}

export function useLookups(): Lookups {
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [statuses, setStatuses] = useState<CandidateStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [companyRows, st, so, cs] = await Promise.all([
        fetchAllRows((f, t) =>
          supabase.from('companies').select(COMPANY_OPTION_COLUMNS).order('name').order('id').range(f, t),
        ),
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
      const firstError = st.error ?? so.error ?? cs.error ?? null;
      if (firstError) setError(firstError.message);
      setCompanies(companyRows);
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

export { useIsMobile } from '../../hooks/useIsMobile';
