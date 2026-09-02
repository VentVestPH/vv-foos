import { useEffect, useMemo, useRef, useState } from 'react';
import { useRole } from '../../auth/SessionProvider';
import { db as supabase } from './db';
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

export function useCanViewDashboards(): boolean {
  return useRole() !== null;
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

export function useOutboxRefresh(onChange: () => void): void {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel('dash-outbox-refresh')
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
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => onChangeRef.current(), 5000);
        },
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, []);
}
