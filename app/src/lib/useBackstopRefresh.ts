import { useEffect, useRef } from 'react';

const DEFAULT_INTERVAL_MS = 20000;

export function useBackstopRefresh(refresh: () => void, intervalMs = DEFAULT_INTERVAL_MS): void {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    const run = () => refreshRef.current();
    const timer = window.setInterval(run, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', run);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', run);
    };
  }, [intervalMs]);
}
