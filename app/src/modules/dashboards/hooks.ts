import { useEffect, useMemo, useRef, useState } from 'react';
import { useRole } from '../../auth/SessionProvider';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { realtimeChannel } from '../../lib/realtimeChannel';
import { supabase } from '../../lib/supabase';
import { EMPTY_CELL } from '../../lib/format';

let staffCache: { id: string; full_name: string }[] | null = null;

export function useStaffNames() {
  const [staff, setStaff] = useState(staffCache ?? []);

  useEffect(() => {
    if (staffCache) return;
    let cancelled = false;
    supabase
      .from('staff')
      .select('id, full_name')
      .order('full_name')
      .then(({ data }) => {
        if (!cancelled && data) {
          staffCache = data;
          setStaff(data);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const byId = useMemo(() => new Map(staff.map((s) => [s.id, s.full_name])), [staff]);
  return (id: string | null | undefined) => (id ? (byId.get(id) ?? EMPTY_CELL) : EMPTY_CELL);
}


export function useIsAdmin(): boolean {
  return useRole() === 'admin';
}

const WATCHED_EVENT_NAMES = [
  'application.created',
  'application.stage_changed',
  'application.hired',
  'candidate.status_changed',
  'requisition.status_changed',
  'deal.stage_changed',
  'intake_item.received',
  'intake_item.imported',
] as const;

const WATCHED_EVENTS = new Set<string>(WATCHED_EVENT_NAMES);

const WATCHED_EVENT_FILTER = `event_name=in.(${WATCHED_EVENT_NAMES.join(',')})`;

type OutboxListener = () => void;

const outboxListeners = new Set<OutboxListener>();
let outboxChannel: RealtimeChannel | null = null;
let outboxTimer: ReturnType<typeof setTimeout> | null = null;

function notifyOutboxListeners() {
  for (const listener of outboxListeners) listener();
}

function subscribeOutbox(listener: OutboxListener): () => void {
  outboxListeners.add(listener);

  if (!outboxChannel) {
    outboxChannel = realtimeChannel('dash-outbox-refresh')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events_outbox',
          filter: WATCHED_EVENT_FILTER,
        },
        (message) => {
          const row = message.new as { event_name?: string };
          if (!row.event_name || !WATCHED_EVENTS.has(row.event_name)) return;
          if (outboxTimer) clearTimeout(outboxTimer);
          outboxTimer = setTimeout(notifyOutboxListeners, 5000);
        },
      )
      .subscribe();
  }

  return () => {
    outboxListeners.delete(listener);
    if (outboxListeners.size > 0 || !outboxChannel) return;
    const channel = outboxChannel;
    outboxChannel = null;
    if (outboxTimer) {
      clearTimeout(outboxTimer);
      outboxTimer = null;
    }
    void supabase.removeChannel(channel);
  };
}

export function useOutboxRefresh(onChange: () => void): void {
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => subscribeOutbox(() => onChangeRef.current()), []);
}
