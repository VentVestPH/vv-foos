import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

let cache: Map<string, string> | null = null;
let pending: Promise<void> | null = null;

function loadNames(): Promise<void> {
  if (pending) return pending;
  pending = Promise.resolve(supabase.from('staff').select('id, full_name')).then(({ data, error }) => {
    if (error || !data) {
      pending = null;
      return;
    }
    cache = new Map(data.map((s) => [s.id, s.full_name]));
  });
  return pending;
}

export function useStaffNames(): (id: string | null | undefined) => string | null {
  const [names, setNames] = useState<Map<string, string>>(cache ?? new Map());

  useEffect(() => {
    if (cache) return;
    let cancelled = false;
    void loadNames().then(() => {
      if (!cancelled && cache) setNames(cache);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return useCallback((id) => (id ? (names.get(id) ?? null) : null), [names]);
}
