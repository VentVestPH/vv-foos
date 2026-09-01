import { useEffect } from 'react';

/**
 * WCAG 2.2 SC 2.4.11 Focus Not Obscured (Minimum), Level AA.
 *
 * `.record-action-bar` is `position: sticky; top: 0` inside the scrolling
 * content pane. W3C Technique F110 makes it a failure when such a bar
 * completely covers the element receiving keyboard focus, and F110's test
 * procedure requires tabbing in BOTH directions.
 *
 * `scroll-padding-top` on the scroll container (see app.css) is the sufficient
 * technique F110 names, and it handles the common case. It does not handle one
 * residual case: an element that is ALREADY inside the visible scrollport but
 * sitting underneath the sticky bar. The browser performs no scroll to reach
 * it, so scroll-padding never engages. Measured: the candidate record passed on
 * scroll-padding alone, the requisition record still had one obscured stop when
 * tabbing up.
 *
 * This closes that gap: on focus, if the focused element overlaps a sticky
 * element on both axes, nudge the scroll container so it clears. Uses
 * `behavior: 'auto'` rather than 'smooth' deliberately, both because the app
 * has no motion by design and because SC 2.3.3 discourages unnecessary motion.
 */
const STICKY_SELECTOR = '.record-action-bar';

export function useStickyFocusGuard(): void {
  useEffect(() => {
    function onFocusIn(event: FocusEvent) {
      const el = event.target;
      if (!(el instanceof HTMLElement)) return;

      const scroller = el.closest<HTMLElement>('.shell-content');
      if (!scroller) return;

      const sticky = scroller.querySelector<HTMLElement>(STICKY_SELECTOR);
      // Never treat the bar's own controls as obscured by it.
      if (!sticky || sticky.contains(el)) return;

      const target = el.getBoundingClientRect();
      const bar = sticky.getBoundingClientRect();
      if (target.width === 0 && target.height === 0) return;

      const overlapsVertically = target.top < bar.bottom && target.bottom > bar.top;
      const overlapsHorizontally = target.left < bar.right && target.right > bar.left;
      if (!overlapsVertically || !overlapsHorizontally) return;

      // Scroll up by exactly the shortfall, plus an 8px breathing gap.
      scroller.scrollTop -= bar.bottom - target.top + 8;
    }

    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);
}
