import { useEffect } from 'react';

const SUFFIX = 'VentVest Front Office OS';

export function useDocumentTitle(name: string | null | undefined) {
  useEffect(() => {
    const trimmed = (name ?? '').trim();
    document.title = trimmed ? `${trimmed} — ${SUFFIX}` : SUFFIX;
    return () => {
      document.title = SUFFIX;
    };
  }, [name]);
}
