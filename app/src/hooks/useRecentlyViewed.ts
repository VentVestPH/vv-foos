import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../auth/SessionProvider';

export interface RecentItem {
  /** Record type, e.g. 'candidate' | 'requisition' | 'company' | 'contact' | 'deal'. */
  type: string;
  /** Record UUID. */
  id: string;
  /** Display label shown in the rail. */
  label: string;
  /** Route to navigate to on click. Defaults to nothing if the caller renders its own link. */
  href?: string;
  viewedAt: string;
}

const MAX_ITEMS = 15;

function storageKey(staffId: string | null): string {
  return `foos.recentlyViewed.${staffId ?? 'anon'}`;
}

function readStore(key: string): RecentItem[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RecentItem[]) : [];
  } catch {
    return [];
  }
}

/**
 * Recently Viewed rail state, persisted in localStorage keyed by staff id.
 * Record pages call `record({ type, id, label, href })` on mount; the nav rail
 * renders `items`. Storage events keep multiple tabs in step.
 */
export function useRecentlyViewed() {
  const { staff } = useSession();
  const key = storageKey(staff?.id ?? null);
  const [items, setItems] = useState<RecentItem[]>(() => readStore(key));

  useEffect(() => {
    setItems(readStore(key));
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setItems(readStore(key));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  const record = useCallback(
    (item: Omit<RecentItem, 'viewedAt'>) => {
      const next: RecentItem[] = [
        { ...item, viewedAt: new Date().toISOString() },
        ...readStore(key).filter(
          (i) => !(i.type === item.type && i.id === item.id),
        ),
      ].slice(0, MAX_ITEMS);
      localStorage.setItem(key, JSON.stringify(next));
      setItems(next);
    },
    [key],
  );

  const clear = useCallback(() => {
    localStorage.removeItem(key);
    setItems([]);
  }, [key]);

  return { items, record, clear };
}
