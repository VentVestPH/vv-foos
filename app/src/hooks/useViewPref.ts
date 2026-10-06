import { useCallback, useState } from 'react';

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const stored = window.localStorage.getItem(key);
    return stored !== null && (allowed as readonly string[]).includes(stored) ? (stored as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useViewPref<T extends string>(key: string, allowed: readonly T[], fallback: T) {
  const [view, setView] = useState<T>(() => readStored(key, allowed, fallback));

  const choose = useCallback((next: T) => {
    setView(next);
    try {
      window.localStorage.setItem(key, next);
    } catch {
      return;
    }
  }, [key]);

  return { view, setView: choose };
}
