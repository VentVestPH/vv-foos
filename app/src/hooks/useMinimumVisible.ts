import { useEffect, useRef, useState } from 'react';

const MIN_MS = 450;

export function useMinimumVisible(active: boolean, minMs: number = MIN_MS): boolean {
  const [held, setHeld] = useState(active);
  const since = useRef<number | null>(active ? Date.now() : null);

  useEffect(() => {
    if (active) {
      if (since.current === null) since.current = Date.now();
      setHeld(true);
      return undefined;
    }
    const started = since.current;
    since.current = null;
    const remaining = started === null ? 0 : minMs - (Date.now() - started);
    if (remaining <= 0) {
      setHeld(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setHeld(false), remaining);
    return () => window.clearTimeout(timer);
  }, [active, minMs]);

  return held;
}
