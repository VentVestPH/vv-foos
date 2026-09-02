import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as sharedClient } from '../../../lib/supabase';
import type {
  Database,
  PersonEducation,
  PersonEmail,
  PersonExperience,
  PersonPhone,
  RequisitionStatus,
  Tables,
} from '../../../lib/database.types';
import { formatDate, formatDateTime } from '../../../lib/format';

type TablesWithRelationships = {
  [K in keyof Database['public']['Tables']]: Database['public']['Tables'][K] & {
    Relationships: [];
  };
};

type RecruitDatabase = {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: TablesWithRelationships;
  };
};

export const supabase = sharedClient as unknown as SupabaseClient<RecruitDatabase>;

export type Person = Tables<'people'>;
export type Requisition = Tables<'requisitions'>;
export type Application = Tables<'applications'>;
export type CandidateProfile = Tables<'candidate_profiles'>;
export type Activity = Tables<'activities'>;
export type TaskRow = Tables<'tasks'>;
export type Reminder = Tables<'reminders'>;
export type Attachment = Tables<'attachments'>;
export type StaffRow = Tables<'staff'>;
export type Company = Tables<'companies'>;
export type Source = Tables<'sources'>;
export type CandidateStatus = Tables<'candidate_statuses'>;
export type ApplicationView = Tables<'application_views'>;
export type ApproverRow = Tables<'requisition_approvers'>;
export type OwnerRow = Tables<'requisition_owners'>;
export type SavedView = Tables<'ats_saved_views'>;

export function personName(
  p: Pick<Person, 'first_name' | 'middle_name' | 'last_name' | 'headline'>,
): string {
  const name = [p.first_name, p.middle_name, p.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  return name || p.headline || 'Unnamed person';
}

export function personEmails(p: Person): PersonEmail[] {
  return Array.isArray(p.emails) ? (p.emails as unknown as PersonEmail[]) : [];
}

export function personPhones(p: Person): PersonPhone[] {
  return Array.isArray(p.phones) ? (p.phones as unknown as PersonPhone[]) : [];
}

export function personEducation(p: Person): PersonEducation[] {
  return Array.isArray(p.education)
    ? (p.education as unknown as PersonEducation[])
    : [];
}

export function personExperience(p: Person): PersonExperience[] {
  return Array.isArray(p.experience)
    ? (p.experience as unknown as PersonExperience[])
    : [];
}

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

export function fmtDate(iso: string | null | undefined): string {
  return formatDate(iso, '');
}

export function fmtDateTime(iso: string | null | undefined): string {
  return formatDateTime(iso, '');
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export const REQ_TRANSITIONS: Record<RequisitionStatus, RequisitionStatus[]> = {
  draft: ['waiting_approval'],
  waiting_approval: ['open', 'draft'],
  open: ['on_hold', 'filled', 'closed'],
  on_hold: ['open', 'filled'],
  filled: ['closed'],
  closed: [],
};

export const REQ_ACTION_LABELS: Record<RequisitionStatus, string> = {
  draft: 'Return to draft',
  waiting_approval: 'Submit for approval',
  open: 'Open requisition',
  on_hold: 'Put on hold',
  filled: 'Mark filled',
  closed: 'Close requisition',
};

export interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

export function sortRows<T extends Record<string, unknown>>(
  rows: T[],
  sort: SortState | null,
): T[] {
  if (!sort) return rows;
  const dir = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = a[sort.key];
    const vb = b[sort.key];
    if (typeof va === 'number' && typeof vb === 'number') {
      return (va - vb) * dir;
    }
    return String(va ?? '').localeCompare(String(vb ?? '')) * dir;
  });
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
