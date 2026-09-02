import { useCallback, useEffect, useState } from 'react';
import { db as supabase } from './db';
import type { IntakeItem } from './lib';

export function useIntakeBadge() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    supabase
      .from('intake_items')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'parsed'])
      .then(({ count: c }) => setCount(c ?? 0));
  }, []);

  useEffect(() => {
    let subscribedOnce = false;
    const channel = supabase
      .channel('intake-badge')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'intake_items' },
        () => refresh(),
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return;
        if (subscribedOnce) {
          void refresh();
          return;
        }
        subscribedOnce = true;
        void refresh();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  return count;
}

export interface IntakeFilters {
  channel?: string;
  targetType?: string;
  status?: string;
  batchLabel?: string;
  submittedBy?: string;
  showAll?: boolean;
}

export function useIntakeQueue(filters: IntakeFilters) {
  const [items, setItems] = useState<IntakeItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    let query = supabase
      .from('intake_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.channel) query = query.eq('channel', filters.channel as never);
    if (filters.targetType) query = query.eq('target_type', filters.targetType as never);
    if (filters.status) {
      query = query.eq('status', filters.status as never);
    } else if (!filters.showAll) {
      query = query.not('status', 'in', '("imported","rejected")');
    }
    if (filters.batchLabel) query = query.eq('batch_label', filters.batchLabel);
    if (filters.submittedBy) query = query.eq('submitted_by', filters.submittedBy);

    query.then(({ data, error }) => {
      if (!error && data) setItems(data);
      setLoading(false);
    });
  }, [filters]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('intake-queue')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'intake_items' },
        () => load(),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') load();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  return { items, loading, reload: load };
}

export interface DedupMatch {
  personId: string;
  name: string;
  headline: string | null;
  hasCandidateProfile: boolean;
  hasContactProfile: boolean;
}

interface DedupInput {
  parsed: unknown;
  linkedin_url?: string | null;
}

export async function checkDedup(item: DedupInput): Promise<DedupMatch | null> {
  const parsed = (item.parsed ?? {}) as Record<string, unknown>;
  const email =
    (parsed.email as string | undefined) ??
    (Array.isArray(parsed.emails) ? (parsed.emails[0] as string) : undefined);
  const linkedin = item.linkedin_url ?? (parsed.linkedin_url as string | undefined);

  let personId: string | null = null;
  if (email) {
    const { data } = await supabase.rpc('find_person_by_email', { p_email: email });
    personId = data ?? null;
  }
  if (!personId && linkedin) {
    const { data } = await supabase.rpc('find_person_by_linkedin', { p_url: linkedin });
    personId = data ?? null;
  }
  if (!personId) return null;

  const [{ data: person }, { data: cp }, { data: conp }] = await Promise.all([
    supabase.from('people').select('first_name, last_name, headline').eq('id', personId).maybeSingle(),
    supabase.from('candidate_profiles').select('person_id').eq('person_id', personId).maybeSingle(),
    supabase.from('contact_profiles').select('person_id').eq('person_id', personId).maybeSingle(),
  ]);

  return {
    personId,
    name: [person?.first_name, person?.last_name].filter(Boolean).join(' ') || 'Unnamed',
    headline: person?.headline ?? null,
    hasCandidateProfile: !!cp,
    hasContactProfile: !!conp,
  };
}
