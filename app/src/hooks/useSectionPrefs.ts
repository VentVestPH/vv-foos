import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '../auth/SessionProvider';
import { supabase } from '../lib/supabase';
import { mergeSectionOrder } from '../lib/sectionOrder';

export interface SectionPrefs {
  hidden: string[];
  isHidden: (section: string) => boolean;
  toggle: (section: string) => void;
  showAll: () => void;
  opensOnLoad: (section: string, fallback: boolean) => boolean;
  toggleOpensOnLoad: (section: string, fallback: boolean) => void;
  order: string[];
  orderFor: (defaults: string[]) => string[];
  setOrder: (next: string[]) => void;
  resetOrder: () => void;
  ready: boolean;
  error: string | null;
}

function readOpen(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = (value as Record<string, unknown>).open;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, boolean> = {};
  for (const [section, flag] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof flag === 'boolean') out[section] = flag;
  }
  return out;
}

function readHidden(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const raw = (value as Record<string, unknown>).hidden;
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is string => typeof entry === 'string');
}

function readOrder(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const raw = (value as Record<string, unknown>).order;
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is string => typeof entry === 'string');
}

export function useSectionPrefs(scope: string): SectionPrefs {
  const { staff } = useSession();
  const staffId = staff?.id ?? null;
  const key = `ui.sections.${scope}`;
  const [hidden, setHidden] = useState<string[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [order, setOrderState] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rowIdRef = useRef<string | null>(null);
  const changedRef = useRef(false);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    rowIdRef.current = null;
    changedRef.current = false;
    if (!staffId) {
      setHidden([]);
      setOpen({});
      setOrderState([]);
      setReady(true);
      queueRef.current = Promise.resolve();
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
      .then(({ data, error: readError }) => {
        if (cancelled) return;
        if (readError) setError(readError.message);
        rowIdRef.current = data?.id ?? null;
        if (!changedRef.current) {
          setHidden(readHidden(data?.value));
          setOpen(readOpen(data?.value));
          setOrderState(readOrder(data?.value));
        }
        setReady(true);
      });
    queueRef.current = Promise.resolve(loaded).then(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [staffId, key]);

  const persist = useCallback(
    (next: string[], nextOpen: Record<string, boolean>, nextOrder: string[]) => {
      changedRef.current = true;
      setHidden(next);
      setOpen(nextOpen);
      setOrderState(nextOrder);
      if (!staffId) return;
      const value = { hidden: next, open: nextOpen, order: nextOrder };
      queueRef.current = queueRef.current.then(async () => {
        if (rowIdRef.current) {
          const { error: updateError } = await supabase
            .from('integration_settings')
            .update({ value, updated_at: new Date().toISOString() })
            .eq('id', rowIdRef.current);
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
        rowIdRef.current = data?.id ?? null;
      }).catch((writeError: unknown) => {
        setError(writeError instanceof Error ? writeError.message : String(writeError));
      });
    },
    [staffId, key],
  );

  const toggle = useCallback(
    (section: string) => {
      persist(
        hidden.includes(section)
          ? hidden.filter((entry) => entry !== section)
          : [...hidden, section],
        open,
        order,
      );
    },
    [hidden, open, order, persist],
  );

  const showAll = useCallback(() => persist([], open, order), [open, order, persist]);

  const opensOnLoad = useCallback(
    (section: string, fallback: boolean) => open[section] ?? fallback,
    [open],
  );

  const toggleOpensOnLoad = useCallback(
    (section: string, fallback: boolean) => {
      persist(hidden, { ...open, [section]: !(open[section] ?? fallback) }, order);
    },
    [hidden, open, order, persist],
  );

  const setOrder = useCallback(
    (next: string[]) => persist(hidden, open, next),
    [hidden, open, persist],
  );

  const resetOrder = useCallback(() => persist(hidden, open, []), [hidden, open, persist]);

  const orderFor = useCallback(
    (defaults: string[]) => mergeSectionOrder(order, defaults),
    [order],
  );

  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);
  const isHidden = useCallback(
    (section: string) => hiddenSet.has(section),
    [hiddenSet],
  );

  return {
    hidden,
    isHidden,
    toggle,
    showAll,
    opensOnLoad,
    toggleOpensOnLoad,
    order,
    orderFor,
    setOrder,
    resetOrder,
    ready,
    error,
  };
}
