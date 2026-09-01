import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../auth/SessionProvider';

export const MAX_BOOKMARKS = 20;

export interface Bookmark {
  href: string;
  label: string;
}

const listeners = new Set<() => void>();

function storageKey(staffId: string | undefined): string {
  return `foos.bookmarks.${staffId ?? 'anon'}`;
}

function read(key: string): Bookmark[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_BOOKMARKS) : [];
  } catch {
    return [];
  }
}

function write(key: string, value: Bookmark[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(value.slice(0, MAX_BOOKMARKS)));
  } catch {
    return;
  }
  listeners.forEach((notify) => notify());
}

export function useBookmarks() {
  const { staff } = useSession();
  const key = storageKey(staff?.id);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => read(key));

  useEffect(() => {
    const sync = () => setBookmarks(read(key));
    sync();
    listeners.add(sync);
    window.addEventListener('storage', sync);
    return () => {
      listeners.delete(sync);
      window.removeEventListener('storage', sync);
    };
  }, [key]);

  const add = useCallback(
    (bookmark: Bookmark) => {
      write(key, [bookmark, ...read(key).filter((b) => b.href !== bookmark.href)]);
    },
    [key],
  );

  const remove = useCallback(
    (href: string) => {
      write(key, read(key).filter((b) => b.href !== href));
    },
    [key],
  );

  const has = useCallback((href: string) => bookmarks.some((b) => b.href === href), [bookmarks]);

  return { bookmarks, add, remove, has, isFull: bookmarks.length >= MAX_BOOKMARKS };
}
