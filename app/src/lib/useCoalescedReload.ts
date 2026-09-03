import { useCallback, useEffect, useRef } from 'react';

export function useCoalescedReload(
  reload: () => Promise<void>,
  delayMs = 250,
  maxWaitMs = 1000,
): () => void {
  const reloadRef = useRef(reload);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSince = useRef(0);
  const running = useRef(false);
  const queued = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current !== null) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, []);

  const run = useCallback(async () => {
    if (running.current) {
      queued.current = true;
      return;
    }
    running.current = true;
    try {
      do {
        queued.current = false;
        await reloadRef.current();
      } while (queued.current && alive.current);
    } finally {
      running.current = false;
    }
  }, []);

  return useCallback(() => {
    if (!alive.current) return;
    if (running.current) {
      queued.current = true;
      return;
    }
    const now = Date.now();
    if (pendingSince.current === 0) pendingSince.current = now;
    const wait = Math.min(delayMs, Math.max(0, maxWaitMs - (now - pendingSince.current)));
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      pendingSince.current = 0;
      if (!alive.current) return;
      void run();
    }, wait);
  }, [delayMs, maxWaitMs, run]);
}
