import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T | null>(null);
  const returnTo = useRef<Element | null>(document.activeElement);

  useEffect(() => {
    if (!active) return;
    const panel = ref.current;
    if (panel === null) return;

    const focusables = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    if (!panel.contains(document.activeElement)) {
      const first = focusables()[0];
      if (first !== undefined) {
        first.focus();
      } else {
        panel.setAttribute('tabindex', '-1');
        panel.focus();
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const current = document.activeElement;
      if (!panel.contains(current)) {
        event.preventDefault();
        firstItem.focus();
        return;
      }
      if (event.shiftKey && current === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && current === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    const back = returnTo.current;
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (back instanceof HTMLElement && document.contains(back)) back.focus();
    };
  }, [active]);

  return ref;
}
