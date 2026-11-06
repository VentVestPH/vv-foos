import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from '../auth/SessionProvider';
import { supabase } from '../lib/supabase';

export type PageSizeChoice = '25' | '50' | '100' | 'all';

export const PAGE_SIZE_CHOICES: { value: PageSizeChoice; label: string }[] = [
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
  { value: 'all', label: 'All' },
];

const ALL_ROWS_CAP = 1000;
const DEFAULT_CHOICE: PageSizeChoice = '25';

function readChoice(value: unknown): PageSizeChoice {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_CHOICE;
  const raw = (value as Record<string, unknown>).size;
  return PAGE_SIZE_CHOICES.some((c) => c.value === raw) ? (raw as PageSizeChoice) : DEFAULT_CHOICE;
}

function pageSizeRows(choice: PageSizeChoice): number {
  return choice === 'all' ? ALL_ROWS_CAP : Number(choice);
}

export function usePageSizePref(scope: string) {
  const { staff } = useSession();
  const staffId = staff?.id ?? null;
  const key = `ui.pageSize.${scope}`;
  const [choice, setChoice] = useState<PageSizeChoice>(DEFAULT_CHOICE);
  const [ready, setReady] = useState(false);
  const rowIdRef = useRef<string | null>(null);
  const changedRef = useRef(false);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    rowIdRef.current = null;
    changedRef.current = false;
    if (!staffId) {
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    const loaded = supabase
      .from('integration_settings')
      .select('id, value')
      .eq('staff_id', staffId)
      .eq('key', key)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        rowIdRef.current = data?.id ?? null;
        if (!changedRef.current) setChoice(readChoice(data?.value));
        setReady(true);
      });
    queueRef.current = Promise.resolve(loaded).then(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [staffId, key]);

  const save = useCallback(
    (next: PageSizeChoice) => {
      changedRef.current = true;
      setChoice(next);
      if (!staffId) return;
      const value = { size: next };
      queueRef.current = queueRef.current
        .then(async () => {
          if (rowIdRef.current) {
            await supabase
              .from('integration_settings')
              .update({ value, updated_at: new Date().toISOString() })
              .eq('id', rowIdRef.current);
            return;
          }
          const { data } = await supabase
            .from('integration_settings')
            .insert({ staff_id: staffId, key, value })
            .select('id')
            .maybeSingle();
          rowIdRef.current = data?.id ?? null;
        })
        .catch(() => undefined);
    },
    [staffId, key],
  );

  return { choice, rows: pageSizeRows(choice), save, ready };
}
