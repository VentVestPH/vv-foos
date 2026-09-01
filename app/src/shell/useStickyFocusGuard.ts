import { useEffect } from 'react';

const STICKY_SELECTOR = '.record-action-bar';

export function useStickyFocusGuard(): void {
  useEffect(() => {
    function onFocusIn(event: FocusEvent) {
      const el = event.target;
      if (!(el instanceof HTMLElement)) return;

      const scroller = el.closest<HTMLElement>('.shell-content');
      if (!scroller) return;

      const sticky = scroller.querySelector<HTMLElement>(STICKY_SELECTOR);

      if (!sticky || sticky.contains(el)) return;

      const target = el.getBoundingClientRect();
      const bar = sticky.getBoundingClientRect();
      if (target.width === 0 && target.height === 0) return;

      const overlapsVertically = target.top < bar.bottom && target.bottom > bar.top;
      const overlapsHorizontally = target.left < bar.right && target.right > bar.left;
      if (!overlapsVertically || !overlapsHorizontally) return;

      scroller.scrollTop -= bar.bottom - target.top + 8;
    }

    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);
}
