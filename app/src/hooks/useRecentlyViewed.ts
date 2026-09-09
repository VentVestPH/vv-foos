import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '../auth/SessionProvider';
import { supabase } from '../lib/supabase';
import type { Json } from '../lib/database.types';

export interface RecentItem {
  type: string;

  id: string;

  label: string;

  href?: string;
  viewedAt: string;
}

const MAX_ITEMS = 50;

const DEFAULT_LIMIT = 10;

const SETTINGS_KEY = 'ui.recentlyViewed';

interface RecentState {
  items: RecentItem[];
  limit: number;
  rowId: string | null;
}

const cache = new Map<string, RecentState>();
const pending = new Map<string, RecentItem[]>();
const writing = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

function newestFirst(entries: RecentItem[]): RecentItem[] {
  return [...entries].sort((a, b) => (b.viewedAt ?? '').localeCompare(a.viewedAt ?? ''));
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

function parse(value: unknown): { items: RecentItem[]; limit: number } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { items: [], limit: DEFAULT_LIMIT };
  }
  const raw = value as Record<string, unknown>;
  const items = Array.isArray(raw.items)
    ? (raw.items as RecentItem[])
        .filter((entry) => entry && typeof entry.id === 'string' && typeof entry.type === 'string')
        .slice(0, MAX_ITEMS)
    : [];
  const limit = typeof raw.limit === 'number' && raw.limit > 0 ? Math.min(MAX_ITEMS, raw.limit) : DEFAULT_LIMIT;
  return { items, limit };
}

function flush(staffId: string): void {
  const write = async () => {
    const state = cache.get(staffId);
    if (!state) return;
    const value = { items: state.items.slice(0, MAX_ITEMS), limit: state.limit } as unknown as Json;
    if (state.rowId) {
      await supabase
        .from('integration_settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('id', state.rowId);
      return;
    }
    const { data } = await supabase
      .from('integration_settings')
      .insert({ staff_id: staffId, key: SETTINGS_KEY, value })
      .select('id')
      .maybeSingle();
    const after = cache.get(staffId);
    if (after) cache.set(staffId, { ...after, rowId: data?.id ?? null });
  };
  const next = (writing.get(staffId) ?? Promise.resolve()).then(write, write);
  writing.set(staffId, next);
  void next;
}

export function useRecentlyViewed() {
  const { staff } = useSession();
  const staffId = staff?.id ?? null;
  const state = staffId ? cache.get(staffId) : undefined;
  const [, bump] = useState(0);
  const loading = useRef<string | null>(null);

  useEffect(() => {
    const listener = () => bump((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!staffId || cache.has(staffId) || loading.current === staffId) return;
    loading.current = staffId;
    void supabase
      .from('integration_settings')
      .select('id, value')
      .eq('staff_id', staffId)
      .eq('key', SETTINGS_KEY)
      .maybeSingle()
      .then(({ data }) => {
        const parsed = parse(data?.value);
        const queued = pending.get(staffId) ?? [];
        pending.delete(staffId);
        const merged = [
          ...queued,
          ...parsed.items.filter(
            (item) => !queued.some((q) => q.type === item.type && q.id === item.id),
          ),
        ].slice(0, MAX_ITEMS);
        cache.set(staffId, { items: merged, limit: parsed.limit, rowId: data?.id ?? null });
        loading.current = null;
        notify();
        if (queued.length > 0) flush(staffId);
      });
  }, [staffId]);

  const persist = useCallback(
    (next: { items: RecentItem[]; limit: number }) => {
      if (!staffId) return;
      const current = cache.get(staffId);
      cache.set(staffId, { ...next, rowId: current?.rowId ?? null });
      notify();
      flush(staffId);
    },
    [staffId],
  );

  const items = useMemo(() => newestFirst(state?.items ?? []), [state?.items]);
  const limit = state?.limit ?? DEFAULT_LIMIT;

  const record = useCallback(
    (item: Omit<RecentItem, 'viewedAt'>) => {
      if (!staffId) return;
      const current = cache.get(staffId);
      if (!current) {
        const queued = pending.get(staffId) ?? [];
        pending.set(
          staffId,
          [
            { ...item, viewedAt: new Date().toISOString() },
            ...queued.filter((q) => !(q.type === item.type && q.id === item.id)),
          ].slice(0, MAX_ITEMS),
        );
        return;
      }
      const next = [
        { ...item, viewedAt: new Date().toISOString() },
        ...current.items.filter((entry) => !(entry.type === item.type && entry.id === item.id)),
      ].slice(0, MAX_ITEMS);
      persist({ items: next, limit: current.limit });
    },
    [staffId, persist],
  );

  const clear = useCallback(() => {
    persist({ items: [], limit });
  }, [persist, limit]);

  const setLimit = useCallback(
    (next: number) => {
      const value = Number.isFinite(next) && next > 0 ? Math.min(MAX_ITEMS, Math.round(next)) : DEFAULT_LIMIT;
      persist({ items, limit: value });
    },
    [persist, items],
  );

  return { items: items.slice(0, limit), record, clear, limit, setLimit };
}
