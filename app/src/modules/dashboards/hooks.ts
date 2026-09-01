import { useEffect, useMemo, useRef, useState } from 'react';
import { useRole } from '../../auth/SessionProvider';
import { db as supabase } from './db';

let staffCache: { id: string; full_name: string }[] | null = null;

/** Staff-name lookup for the Activity dashboard — same cached-lookup
 * pattern as sales/hooks.ts useStaffList(), duplicated locally rather than
 * imported cross-module (each module owns its own read-only lookups). */
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
  return (id: string | null | undefined) => (id ? (byId.get(id) ?? '—') : '—');
}

/** Every authenticated staff member sees dashboards — RLS on the underlying
 * `dash.*` views is the real boundary (a sourcer's vw_ats_funnel query only
 * ever returns their own-sourced applications, a bd user's is empty, etc.).
 * This hook is only a UI courtesy, same convention as useCanEditCrm(). */
export function useCanViewDashboards(): boolean {
  return useRole() !== null;
}

export function useIsAdmin(): boolean {
  return useRole() === 'admin';
}

const WATCHED_EVENTS = new Set([
  'application.created',
  'application.stage_changed',
  'application.hired',
  'candidate.status_changed',
  'requisition.status_changed',
  'deal.stage_changed',
  'intake_item.received',
  'intake_item.imported',
]);

/**
 * Realtime refresh trigger (brief instruction: "no manual reload"). Listens
 * to events_outbox inserts (RLS-scoped like every other Realtime use in this
 * app — see HiredPromotionListener/useIntakeBadge) and calls `onChange`
 * debounced 5s after the last matching event, rather than diffing individual
 * rows — dashboards re-run their own aggregate queries on change.
 */
export function useOutboxRefresh(onChange: () => void): void {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel('dash-outbox-refresh')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events_outbox' },
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
