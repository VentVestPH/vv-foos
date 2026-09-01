import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../auth/SessionProvider';

export interface RecentItem {
  type: string;

  id: string;

  label: string;

  href?: string;
  viewedAt: string;
}

const MAX_ITEMS = 15;

const listeners = new Set<() => void>();

function storageKey(staffId: string | null): string {
  return `foos.recentlyViewed.${staffId ?? 'anon'}`;
}

function readStore(key: string): RecentItem[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RecentItem[]).slice(0, MAX_ITEMS) : [];
  } catch {
    return [];
  }
}

function writeStore(key: string, value: RecentItem[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(value.slice(0, MAX_ITEMS)));
  } catch {
    return;
  }
  listeners.forEach((notify) => notify());
}

export function useRecentlyViewed() {
  const { staff } = useSession();
  const key = storageKey(staff?.id ?? null);
  const [items, setItems] = useState<RecentItem[]>(() => readStore(key));

  useEffect(() => {
    const sync = () => setItems(readStore(key));
    sync();
    listeners.add(sync);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) sync();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(sync);
      window.removeEventListener('storage', onStorage);
    };
  }, [key]);

  const record = useCallback(
    (item: Omit<RecentItem, 'viewedAt'>) => {
      const next: RecentItem[] = [
        { ...item, viewedAt: new Date().toISOString() },
        ...readStore(key).filter((i) => !(i.type === item.type && i.id === item.id)),
      ].slice(0, MAX_ITEMS);
      writeStore(key, next);
    },
    [key],
  );

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {
      return;
    }
    listeners.forEach((notify) => notify());
  }, [key]);

  return { items, record, clear };
}
