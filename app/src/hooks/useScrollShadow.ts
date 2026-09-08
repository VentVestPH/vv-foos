import { useCallback, useEffect, useRef } from 'react';

export function useScrollShadow<T extends HTMLElement>() {
  const node = useRef<T | null>(null);
  const detach = useRef<(() => void) | null>(null);

  const measure = useCallback(() => {
    const el = node.current;
    if (!el) return;
    const scrollable = el.scrollHeight - el.clientHeight > 1;
    const atTop = el.scrollTop <= 1;
    const atBottom = el.scrollTop >= el.scrollHeight - el.clientHeight - 1;
    el.dataset.shadowTop = scrollable && !atTop ? 'true' : 'false';
    el.dataset.shadowBottom = scrollable && !atBottom ? 'true' : 'false';
  }, []);

  const attach = useCallback(
    (el: T | null) => {
      detach.current?.();
      detach.current = null;
      node.current = el;
      if (!el) return;
      measure();
      el.addEventListener('scroll', measure, { passive: true });
      const observer = new ResizeObserver(measure);
      observer.observe(el);
      for (const child of el.children) observer.observe(child);
      detach.current = () => {
        el.removeEventListener('scroll', measure);
        observer.disconnect();
      };
    },
    [measure],
  );

  useEffect(() => () => detach.current?.(), []);

  return attach;
}
