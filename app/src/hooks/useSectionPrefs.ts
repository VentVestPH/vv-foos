import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from '../auth/SessionProvider';
import { supabase } from '../lib/supabase';

export interface SectionPrefs {
  hidden: string[];
  isHidden: (section: string) => boolean;
  toggle: (section: string) => void;
  showAll: () => void;
  ready: boolean;
  error: string | null;
}

function readHidden(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const raw = (value as Record<string, unknown>).hidden;
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is string => typeof entry === 'string');
}

export function useSectionPrefs(scope: string): SectionPrefs {
  const { staff } = useSession();
  const staffId = staff?.id ?? null;
  const key = `ui.sections.${scope}`;
  const [hidden, setHidden] = useState<string[]>([]);
  const [rowId, setRowId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!staffId) {
      setHidden([]);
      setRowId(null);
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    void supabase
      .from('integration_settings')
      .select('id, value')
      .eq('staff_id', staffId)
      .eq('key', key)
      .maybeSingle()
      .then(({ data, error: readError }) => {
        if (cancelled) return;
        if (readError) setError(readError.message);
        setRowId(data?.id ?? null);
        setHidden(readHidden(data?.value));
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [staffId, key]);

  const persist = useCallback(
    (next: string[]) => {
      setHidden(next);
      if (!staffId) return;
      const value = { hidden: next };
      void (async () => {
        if (rowId) {
          const { error: updateError } = await supabase
            .from('integration_settings')
            .update({ value, updated_at: new Date().toISOString() })
            .eq('id', rowId);
          setError(updateError ? updateError.message : null);
          return;
        }
        const { data, error: insertError } = await supabase
          .from('integration_settings')
          .insert({ staff_id: staffId, key, value })
          .select('id')
          .maybeSingle();
        if (insertError) {
          setError(insertError.message);
          return;
        }
        setError(null);
        setRowId(data?.id ?? null);
      })();
    },
    [staffId, key, rowId],
  );

  const toggle = useCallback(
    (section: string) => {
      persist(
        hidden.includes(section)
          ? hidden.filter((entry) => entry !== section)
          : [...hidden, section],
      );
    },
    [hidden, persist],
  );

  const showAll = useCallback(() => persist([]), [persist]);

  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);
  const isHidden = useCallback(
    (section: string) => hiddenSet.has(section),
    [hiddenSet],
  );

  return { hidden, isHidden, toggle, showAll, ready, error };
}
