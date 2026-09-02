import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { IntakeItem } from './lib';

type IntakeItemsListener = () => void;

const intakeItemsListeners = new Set<IntakeItemsListener>();
let intakeItemsChannel: RealtimeChannel | null = null;
let intakeItemsSubscribed = false;

function notifyIntakeItemsListeners() {
  for (const listener of intakeItemsListeners) listener();
}

function subscribeIntakeItems(listener: IntakeItemsListener): () => void {
  intakeItemsListeners.add(listener);

  if (!intakeItemsChannel) {
    intakeItemsSubscribed = false;
    intakeItemsChannel = supabase
      .channel('intake-items')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'intake_items' },
        notifyIntakeItemsListeners,
      )
      .subscribe((state) => {
        if (state !== 'SUBSCRIBED') return;
        intakeItemsSubscribed = true;
        notifyIntakeItemsListeners();
      });
  } else if (intakeItemsSubscribed) {
    listener();
  }

  return () => {
    intakeItemsListeners.delete(listener);
    if (intakeItemsListeners.size > 0 || !intakeItemsChannel) return;
    const channel = intakeItemsChannel;
    intakeItemsChannel = null;
    intakeItemsSubscribed = false;
    void supabase.removeChannel(channel);
  };
}

export function useIntakeBadge() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    supabase
      .from('intake_items')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'parsed'])
      .then(({ count: c }) => setCount(c ?? 0));
  }, []);

  useEffect(() => subscribeIntakeItems(refresh), [refresh]);

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
  const { channel, targetType, status, batchLabel, submittedBy, showAll } = filters;
  const [items, setItems] = useState<IntakeItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    let query = supabase
      .from('intake_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (channel) query = query.eq('channel', channel as never);
    if (targetType) query = query.eq('target_type', targetType as never);
    if (status) {
      query = query.eq('status', status as never);
    } else if (!showAll) {
      query = query.not('status', 'in', '("imported","rejected")');
    }
    if (batchLabel) query = query.eq('batch_label', batchLabel);
    if (submittedBy) query = query.eq('submitted_by', submittedBy);

    query.then(({ data, error }) => {
      if (!error && data) setItems(data);
      setLoading(false);
    });
  }, [channel, targetType, status, batchLabel, submittedBy, showAll]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => subscribeIntakeItems(() => loadRef.current()), []);

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
