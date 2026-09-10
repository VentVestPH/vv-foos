import { useCallback, useRef } from 'react';

export function useScrollShadow<T extends HTMLElement>() {
  const detach = useRef<(() => void) | null>(null);

  return useCallback((el: T | null) => {
    detach.current?.();
    detach.current = null;
    if (!el) return;

    const measure = () => {
      const scrollable = el.scrollHeight - el.clientHeight > 1;
      const atTop = el.scrollTop <= 1;
      const atBottom = el.scrollTop >= el.scrollHeight - el.clientHeight - 1;
      el.dataset.shadowTop = scrollable && !atTop ? 'true' : 'false';
      el.dataset.shadowBottom = scrollable && !atBottom ? 'true' : 'false';
    };

    measure();
    el.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    const sizes = new ResizeObserver(measure);
    sizes.observe(el);
    for (const child of el.children) sizes.observe(child);
    const contents = new MutationObserver(() => {
      sizes.disconnect();
      sizes.observe(el);
      for (const child of el.children) sizes.observe(child);
      measure();
    });
    contents.observe(el, { childList: true, subtree: true });
    const frame = requestAnimationFrame(measure);

    detach.current = () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      sizes.disconnect();
      contents.disconnect();
    };
  }, []);
}
