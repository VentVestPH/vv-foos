import { useCallback, useEffect, useRef, useState } from 'react';

const EXIT_MS = 140;

export function useDismissable(open: boolean, onClose: () => void) {
  const [closing, setClosing] = useState(false);
  const timer = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const requestClose = useCallback(() => {
    if (!open || timer.current !== null) return;
    setClosing(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setClosing(false);
      onClose();
    }, EXIT_MS);
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;
    clear();
    setClosing(false);
  }, [open, clear]);

  useEffect(() => clear, [clear]);

  return { closing, requestClose };
}
