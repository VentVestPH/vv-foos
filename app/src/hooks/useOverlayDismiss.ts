import { useCallback, useEffect, useRef, useState } from 'react';

const OVERLAY_EXIT_MS = 140;

export function useOverlayDismiss(onClose: (() => void) | undefined) {
  const [closing, setClosing] = useState(false);
  const timer = useRef<number | null>(null);
  const closingRef = useRef(false);

  const requestClose = useCallback(() => {
    if (!onClose || closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      closingRef.current = false;
      setClosing(false);
      onClose();
    }, OVERLAY_EXIT_MS);
  }, [onClose]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    if (onClose) return;
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    closingRef.current = false;
    setClosing(false);
  }, [onClose]);

  useEffect(() => {
    if (!onClose) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, requestClose]);

  return { closing, requestClose };
}
